/**
 * PresetEditorView (PRESET-JEWEL-PLAN.md P4, slice 1 - the manuscript spine). Transcribes the top
 * of design/vs-preset-hybrid.html: the shared EditorEhead (spine + WriteForStrip + Save) over the
 * block manuscript. The settings card, the row expansion, the toolbar and the right rail land in
 * the following P4 slices; this one makes a real, editable preset where the P1 stub was.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import type { PresetBody } from "../../../../entities/preset";
import {
  parseWriteFor,
  placementsForProfile,
  presetWeight,
  PRESET_WRITE_FOR_LABELS,
  PRESET_WRITE_FOR_PROFILES,
  type PresetWriteForProfile,
} from "../../../../core/preset";
import { EditorEhead } from "../../../components/editor-ehead";
import { WriteForStrip } from "../../../components/write-for-strip";
import { BlockList } from "./block-list";
import { PromptEditPanel } from "./prompt-edit-panel";
import { addBlock, deleteBlock, moveBlock, patchBlock, presetDirty, toggleBlock } from "./session";
import s from "./preset.module.css";

export interface PresetEditorViewProps {
  entity: unknown;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

const WRITE_FOR_PREF = "preset.writeFor";

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function bodyFromEntity(entity: unknown): PresetBody {
  const e = isRec(entity) ? entity : {};
  const b = isRec(e.body) ? (e.body as unknown as PresetBody) : null;
  if (b && typeof b.name === "string" && Array.isArray(b.prompts)) return structuredClone(b);
  return { name: "Untitled preset", prompts: [] };
}

export function PresetEditorView({ entity, ctx, piece, topRight }: PresetEditorViewProps): JSX.Element {
  const initBody = useMemo(() => bodyFromEntity(entity), [entity]);
  const [baseline, setBaseline] = useState(() => structuredClone(initBody));
  const [body, setBody] = useState(() => structuredClone(initBody));
  const [saving, setSaving] = useState(false);
  const [writeFor, setWriteForState] = useState<PresetWriteForProfile>(() =>
    parseWriteFor(ctx.prefs.get(WRITE_FOR_PREF)),
  );
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedChecks, setSelectedChecks] = useState<ReadonlySet<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dirty = presetDirty(body, baseline);
  const weight = useMemo(() => presetWeight(body), [body]);
  const stops = useMemo(() => placementsForProfile(writeFor), [writeFor]);
  const selectedBlock = body.prompts.find((p) => p.id === selectedId) ?? null;

  const flip = (set: ReadonlySet<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const toggleExpand = (id: string): void => setExpandedIds((prev) => flip(prev, id));
  const toggleCheck = (id: string): void => setSelectedChecks((prev) => flip(prev, id));

  const removeBlock = (id: string): void => {
    setBody((b) => deleteBlock(b, id));
    if (selectedId === id) setSelectedId(null);
  };

  const setWriteFor = (p: PresetWriteForProfile): void => {
    setWriteForState(p);
    ctx.prefs.set(WRITE_FOR_PREF, p);
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
        { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "preset", id: piece.id, body, original },
        { overwrite: true },
      );
      setBaseline(structuredClone(body));
      ctx.setStatus(`saved preset · ${body.name}`);
    } catch {
      ctx.setStatus("could not save the preset");
    } finally {
      setSaving(false);
    }
  }, [saving, dirty, body, ctx, entity, piece.id]);

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

  const monogram = (body.name.trim().charAt(0) || "P").toUpperCase();
  const meta = `preset · ${weight.totalCount} block${weight.totalCount === 1 ? "" : "s"} · ${weight.enabledCount} on · ~${weight.tokens} tokens`;

  return (
    <div className={s.root} style={piece.accent ? ({ "--a": piece.accent } as CSSProperties) : undefined}>
      <EditorEhead
        mark={monogram}
        name={body.name}
        onNameChange={(v) => setBody((b) => ({ ...b, name: v }))}
        namePlaceholder="Untitled preset"
        nameAriaLabel="Preset name"
        meta={meta}
        dirty={dirty}
        saving={saving}
        onSave={() => void doSave()}
        topRight={topRight}
      >
        <WriteForStrip
          profiles={PRESET_WRITE_FOR_PROFILES}
          labels={PRESET_WRITE_FOR_LABELS}
          value={writeFor}
          onChange={setWriteFor}
        />
      </EditorEhead>

      <div className={s.body}>
        <div className={s.listCol}>
          <BlockList
            blocks={body.prompts}
            selectedId={selectedId}
            selectedChecks={selectedChecks}
            expandedIds={expandedIds}
            onSelectRow={setSelectedId}
            onToggleCheck={toggleCheck}
            onToggleExpand={toggleExpand}
            onToggle={(id) => setBody((b) => toggleBlock(b, id))}
            onDelete={removeBlock}
            onReorder={(fromId, toIndex) => setBody((b) => moveBlock(b, fromId, toIndex))}
            onPatch={(id, patch) => setBody((b) => patchBlock(b, id, patch))}
            onAdd={() => setBody((b) => addBlock(b))}
          />
        </div>
        <PromptEditPanel
          block={selectedBlock}
          stops={stops}
          onClose={() => setSelectedId(null)}
          onPatch={(patch) => {
            if (selectedId) setBody((b) => patchBlock(b, selectedId, patch));
          }}
        />
      </div>
    </div>
  );
}
