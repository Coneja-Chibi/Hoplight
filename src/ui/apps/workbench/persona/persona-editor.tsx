/**
 * PersonaEditor (P4 v2) - the persona sheet wearing the CHARACTER editor's chassis (the kinship
 * ruling): the same .bento three-column grid, BentoCard tiles, and .lcard face plate from
 * editor-styles. Left = sticky face + linked lorebook; middle = Identity + the section tiles +
 * flat Identity Text; right = Color Palette + Prompt Injection + LIVE preview (the real
 * inject.ts output + the shared token convention) + the default star. Save preserves the sealed
 * `original` so imported personas round-trip byte-true.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import type { PersonaBody } from "../../../../entities/persona/schema";
import {
  injectPersonaXml,
  injectionsForProfile,
  parseWriteFor,
  PERSONA_INJECTION_LABELS,
  PERSONA_WRITE_FOR_LABELS,
  PERSONA_WRITE_FOR_PROFILES,
  platformOwnsField,
  type PersonaWriteForProfile,
} from "../../../../core/persona";
import { isPreviewablePortraitRef } from "../../../../core/media";
import { MobileEditorHead, type MobileMenuItem } from "../../../components/mobile-editor-head";
import { WriteForStrip } from "../../../components/write-for-strip";
import { EditorEhead } from "../../../components/editor-ehead";
import { PortraitCard } from "../controls/portrait-card";
import { KnowledgeRail } from "../lore/KnowledgeRail";
import es from "../editor-styles";
import { InjectionCard } from "./injection-card";
import {
  ContentCard,
  IdentityCard,
  PaletteCard,
  PreviewCard,
  SectionCard,
} from "./persona-cards";
import { personaDirty, setPortrait } from "./session";
import s from "./persona.module.css";

export interface PersonaEditorViewProps {
  entity: unknown;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

const WRITE_FOR_PREF = "persona.writeFor";
export const DEFAULT_PERSONA_PREF = "persona.default";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function bodyFromEntity(entity: unknown): PersonaBody {
  const e = isRec(entity) ? entity : {};
  const b = isRec(e.body) ? (e.body as unknown as PersonaBody) : null;
  if (b && typeof b.name === "string" && typeof b.content === "string") return structuredClone(b);
  return { name: "Untitled persona", content: "" };
}

export function PersonaEditorView({ entity, ctx, piece, topRight }: PersonaEditorViewProps): JSX.Element {
  const initBody = useMemo(() => bodyFromEntity(entity), [entity]);
  const [baseline, setBaseline] = useState(() => structuredClone(initBody));
  const [body, setBody] = useState(() => structuredClone(initBody));
  const [saving, setSaving] = useState(false);
  const [writeFor, setWriteForState] = useState<PersonaWriteForProfile>(() =>
    parseWriteFor(ctx.prefs.get(WRITE_FOR_PREF)),
  );
  const [defaultId, setDefaultId] = useState<string>(() => String(ctx.prefs.get(DEFAULT_PERSONA_PREF) ?? ""));

  const dirty = personaDirty(body, baseline);
  const xml = useMemo(() => injectPersonaXml(body), [body]);
  const tokens = Math.ceil(xml.length / 4); // the lore estimator's convention (chars/4)
  const stops = injectionsForProfile(writeFor);

  const setWriteFor = (p: PersonaWriteForProfile): void => {
    setWriteForState(p);
    ctx.prefs.set(WRITE_FOR_PREF, p);
  };

  const toggleDefault = (): void => {
    const next = defaultId === piece.id ? "" : piece.id;
    setDefaultId(next);
    ctx.prefs.set(DEFAULT_PERSONA_PREF, next);
    ctx.setStatus(next ? `${body.name || "this persona"} is the default now` : "default persona cleared");
  };

  const doSave = useCallback(async (): Promise<void> => {
    if (saving || !dirty) return;
    if (!body.name.trim()) {
      ctx.setStatus("a name is required before saving");
      return;
    }
    setSaving(true);
    try {
      const original = isRec(entity) && isRec(entity.original) ? entity.original : {};
      await ctx.api.saveEntity(
        { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "persona", id: piece.id, body, original },
        { overwrite: true },
      );
      setBaseline(structuredClone(body));
      ctx.setStatus(`saved persona · ${body.name}`);
    } catch {
      ctx.setStatus("could not save the persona");
    } finally {
      setSaving(false);
    }
  }, [saving, dirty, body, ctx, entity, piece.id]);

  // ctrl/cmd+S saves (the house editor reflex)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void doSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSave]);

  const mobileMenu: MobileMenuItem[] = PERSONA_WRITE_FOR_PROFILES.map((p) => ({
    label: `${writeFor === p ? "● " : "○ "}Writing for: ${PERSONA_WRITE_FOR_LABELS[p]}`,
    onPick: () => setWriteFor(p),
  }));

  const monogram = (body.name.trim().charAt(0) || "P").toUpperCase();
  // the character editor's resolution order: a previewable draft ref wins, else the studio API
  const draftRef = body.media?.portrait?.ref ?? "";
  const portraitUrl = isPreviewablePortraitRef(draftRef)
    ? draftRef
    : piece.hasPortrait
      ? `/api/studio/portrait?kind=persona&id=${encodeURIComponent(piece.id)}`
      : null;
  const onBody = setBody;

  return (
    <div className={s.root} style={piece.accent ? ({ "--a": piece.accent } as CSSProperties) : undefined}>
      <div className={s.mHeadGate}>
        <MobileEditorHead
          name={body.name || "Untitled persona"}
          sub={`persona · ${saving ? "saving…" : dirty ? "unsaved changes" : "saved"}`}
          dirty={dirty}
          saving={saving}
          onBack={() => ctx.workbench.remove(piece.id, piece.kind)}
          onSave={() => void doSave()}
          menu={mobileMenu}
        />
      </div>

      <EditorEhead
        mark={monogram}
        name={body.name}
        onNameChange={(v) => setBody((b) => ({ ...b, name: v }))}
        namePlaceholder="Untitled persona"
        nameAriaLabel="Persona name"
        meta={`persona · ${dirty ? "unsaved" : "saved"}`}
        dirty={dirty}
        saving={saving}
        onSave={() => void doSave()}
        topRight={topRight}
      >
        <WriteForStrip
          profiles={PERSONA_WRITE_FOR_PROFILES}
          labels={PERSONA_WRITE_FOR_LABELS}
          value={writeFor}
          onChange={setWriteFor}
        />
      </EditorEhead>

      <div className={s.body}>
        <div className={es.bento}>
          <div className={`${es.bcol} ${es.bcolLeft}`}>
            <PortraitCard
              artUrl={portraitUrl}
              name={body.name || "Untitled persona"}
              tokens={tokens}
              updatedAt={null}
              styles={es}
              showSprites={false}
              onPortraitChange={(portrait) => setBody((b) => setPortrait(b, portrait))}
            />
            <KnowledgeRail
              ctx={ctx}
              refs={body.knowledgeRefs ?? []}
              onChange={(next) => setBody((b) => ({ ...b, knowledgeRefs: next.length ? next : undefined }))}
            />
          </div>
          <div className={es.bcol}>
            <IdentityCard body={body} onBody={onBody} />
            <SectionCard body={body} onBody={onBody} writeFor={writeFor} sectionKey="appearance" title="Appearance" placeholder="Build, features, style..." />
            <SectionCard body={body} onBody={onBody} writeFor={writeFor} sectionKey="body" title="Body" placeholder="Physical details (folds into Appearance in the prompt)..." />
            <SectionCard body={body} onBody={onBody} writeFor={writeFor} sectionKey="personality" title="Personality" placeholder="How they act, their demeanor..." />
            <SectionCard body={body} onBody={onBody} writeFor={writeFor} sectionKey="quirks" title="Quirks" placeholder="Habits, mannerisms, speech..." />
            <SectionCard body={body} onBody={onBody} writeFor={writeFor} sectionKey="history" title="History" placeholder="Background, origins..." />
            <ContentCard body={body} onBody={onBody} writeFor={writeFor} />
          </div>
          <div className={es.bcol}>
            {platformOwnsField(writeFor, "colors") && <PaletteCard body={body} onBody={onBody} />}
            {stops.length > 0 && platformOwnsField(writeFor, "injection") && (
              <InjectionCard
                body={body}
                onBody={onBody}
                stops={stops}
                labels={PERSONA_INJECTION_LABELS}
                showWrapper={platformOwnsField(writeFor, "wrapper")}
              />
            )}
            <PreviewCard
              xml={xml}
              tokens={tokens}
              stopLabel={PERSONA_INJECTION_LABELS[body.chatInjection?.position ?? "character"]?.label ?? "Character"}
            />
            <button
              type="button"
              className={defaultId === piece.id ? `${s.defaultBtn} ${s.defaultOn}` : s.defaultBtn}
              aria-pressed={defaultId === piece.id}
              onClick={toggleDefault}
            >
              {defaultId === piece.id ? "★ Default persona" : "☆ Set as default persona"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
