/**
 * PersonaEditor (P4) - RC's PersonaPanel reborn on the binder, transcribed from
 * design/vs-persona-editor.html wire 1. One document: starring card, palette, section stack,
 * injection card, and the rail (LIVE preview = the real inject.ts output + the shared token
 * convention, linked lorebook, default star). Save preserves the sealed `original` so imported
 * personas round-trip byte-true. The default persona is a studio pref ("persona.default").
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
import { MobileEditorHead, type MobileMenuItem } from "../../../components/mobile-editor-head";
import { StarringCard } from "./starring-card";
import { SectionsStack } from "./sections-stack";
import { InjectionCard } from "./injection-card";
import { PreviewRail } from "./preview-rail";
import { personaDirty } from "./session";
import { personaStyles as s } from "./persona-styles";

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
  const portraitUrl = piece.hasPortrait
    ? `/api/studio/portrait?kind=persona&id=${encodeURIComponent(piece.id)}`
    : null;

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

      <header className={s.ehead}>
        <span className={s.spineMark}>{monogram}</span>
        <div>
          <input
            className={s.spineName}
            value={body.name}
            placeholder="Untitled persona"
            aria-label="Persona name"
            onChange={(e) => setBody((b) => ({ ...b, name: e.target.value }))}
          />
          <span className={s.spineMeta}>persona · {dirty ? "unsaved" : "saved"}</span>
        </div>
        <span className={s.eacts}>
          <span className={s.wfor} role="group" aria-label="Write for one host">
            <i className={s.wforLabel}>Write for</i>
            {PERSONA_WRITE_FOR_PROFILES.map((p) => (
              <button
                key={p}
                type="button"
                className={writeFor === p ? `${s.wf} ${s.wfOn}` : s.wf}
                aria-pressed={writeFor === p}
                onClick={() => setWriteFor(p)}
              >
                {PERSONA_WRITE_FOR_LABELS[p]}
              </button>
            ))}
          </span>
          <button type="button" className={s.save} disabled={saving || !dirty} onClick={() => void doSave()}>
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
          {topRight}
        </span>
      </header>

      <div className={s.cols}>
        <main className={s.pageCol}>
          <StarringCard body={body} onBody={setBody} portraitUrl={portraitUrl} monogram={monogram} />
          <SectionsStack body={body} onBody={setBody} writeFor={writeFor} />
          {stops.length > 0 && platformOwnsField(writeFor, "injection") && (
            <InjectionCard
              body={body}
              onBody={setBody}
              stops={stops}
              labels={PERSONA_INJECTION_LABELS}
              showWrapper={platformOwnsField(writeFor, "wrapper")}
            />
          )}
        </main>
        <aside className={s.railCol}>
          <PreviewRail
            ctx={ctx}
            body={body}
            onBody={setBody}
            xml={xml}
            tokens={tokens}
            stopLabel={PERSONA_INJECTION_LABELS[body.chatInjection?.position ?? "character"]?.label ?? "Character"}
            isDefault={defaultId === piece.id}
            onToggleDefault={toggleDefault}
          />
        </aside>
      </div>
    </div>
  );
}
