/**
 * PresetEditorView (PRESET-JEWEL-PLAN.md P4, slice 1 - the manuscript spine). Transcribes the top
 * of design/vs-preset-hybrid.html: the shared EditorEhead (spine + WriteForStrip + Save) over the
 * block manuscript. The settings card, the row expansion, the toolbar and the right rail land in
 * the following P4 slices; this one makes a real, editable preset where the P1 stub was.
 */
import { useCallback, useMemo, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { accentVars } from "../../../_shared/decks";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import type { PresetBody } from "../../../../entities/preset";
import {
  parseWriteFor,
  placementsForProfile,
  platformOwnsField,
  presetWeight,
  promptCounts,
  visiblePrompts,
  PRESET_WRITE_FOR_LABELS,
  PRESET_WRITE_FOR_PROFILES,
  type PresetWriteForProfile,
  type PromptFilterTab,
} from "../../../../core/preset";
import { EditorEhead } from "../../../components/editor-ehead";
import { WriteForStrip } from "../../../components/write-for-strip";
import { BlockList } from "./block-list";
import { ListToolbar } from "./list-toolbar";
import { BulkBar } from "./bulk-bar";
import { SettingsBar } from "./settings-bar";
import { PromptEditPanel } from "./prompt-edit-panel";
import { LiveBuild } from "./live-build";
import { SplitPane } from "../../../components/split-pane";
import {
  addBlock,
  addGroup,
  bulkDelete,
  bulkDuplicate,
  bulkSetEnabled,
  deleteBlock,
  moveBlock,
  patchBlock,
  presetDirty,
  setBlockGroup,
  setSampler,
  toggleBlock,
} from "./session";
import s from "./preset.module.css";
import { useEditorGuards } from "../use-editor-guards";

export interface PresetEditorViewProps {
  entity: unknown;
  revision: string;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

const WRITE_FOR_PREF = "preset.writeFor";
/** Where the divider between the prompt list and the rail sits, remembered per studio. */
const PREF_SPLIT = "preset.split";

/** The rail is the ONE place whole-preset truth lives (the locked wire's ruling), hence the tabs. */
type RailTab = "edit" | "build";
const RAIL_TABS: ReadonlyArray<{ id: RailTab; label: string }> = [
  { id: "edit", label: "Edit Prompt" },
  { id: "build", label: "Live Build" },
];

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function bodyFromEntity(entity: unknown): PresetBody {
  const e = isRec(entity) ? entity : {};
  const b = isRec(e.body) ? (e.body as unknown as PresetBody) : null;
  if (b && typeof b.name === "string" && Array.isArray(b.prompts)) return structuredClone(b);
  return { name: "Untitled preset", prompts: [] };
}

export function PresetEditorView({ entity, revision, ctx, piece, topRight }: PresetEditorViewProps): JSX.Element {
  const revisionRef = useRef(revision);
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
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<PromptFilterTab>("all");
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(() => new Set());
  const [rail, setRail] = useState<RailTab>("edit");

  const dirty = presetDirty(body, baseline);
  const weight = useMemo(() => presetWeight(body), [body]);
  const stops = useMemo(() => placementsForProfile(writeFor), [writeFor]);
  const selectedBlock = body.prompts.find((p) => p.id === selectedId) ?? null;
  // counts span the WHOLE list so the tab badges hold still while you filter (RC does the same)
  const counts = useMemo(() => promptCounts(body.prompts), [body.prompts]);
  const shown = useMemo(() => visiblePrompts(body.prompts, tab, query), [body.prompts, tab, query]);

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
    setSelectedChecks((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const clearChecks = (): void => setSelectedChecks(new Set());

  /** Bulk ops act on the CHECKED set, which can include rows the current filter hides. */
  const doBulk = (op: (b: PresetBody, ids: ReadonlySet<string>) => PresetBody, clearAfter: boolean): void => {
    const ids = selectedChecks;
    if (ids.size === 0) return;
    setBody((b) => op(b, ids));
    if (clearAfter) {
      if (selectedId && ids.has(selectedId)) setSelectedId(null);
      clearChecks();
    }
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
      const saved = await ctx.api.saveEditedEntity(
        { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "preset", id: piece.id, body, original },
        revisionRef.current,
      );
      revisionRef.current = saved.revision;
      setBaseline(structuredClone(body));
      ctx.setStatus(`saved preset · ${body.name}`);
    } catch (e) {
      ctx.setStatus(e instanceof Error ? e.message : "could not save the preset");
    } finally {
      setSaving(false);
    }
  }, [saving, dirty, body, ctx, entity, piece.id]);

  useEditorGuards(ctx, piece, dirty, doSave);

  const monogram = (body.name.trim().charAt(0) || "P").toUpperCase();
  const meta = `preset · ${weight.totalCount} block${weight.totalCount === 1 ? "" : "s"} · ${weight.enabledCount} on · ~${weight.tokens} tokens`;

  return (
    <div className={s.root} style={accentVars(piece.accent) as CSSProperties | undefined}>
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

      <SettingsBar
        body={body}
        showSamplers={platformOwnsField(writeFor, "samplers")}
        onDescription={(v) => setBody((b) => ({ ...b, description: v }))}
        onSampler={(key, value) => setBody((b) => setSampler(b, key, value))}
      />

      <SplitPane
        stored={ctx.prefs.get(PREF_SPLIT)}
        onSplit={(next) => { ctx.prefs.set(PREF_SPLIT, next); }}
        label="Resize the prompt list and the rail"
        left={<div className={s.listCol}>
          <ListToolbar
            counts={counts}
            query={query}
            onQuery={setQuery}
            tab={tab}
            onTab={setTab}
            onExpandAll={() => setExpandedIds(new Set(shown.map((p) => p.id)))}
            onCollapseAll={() => setExpandedIds(new Set())}
            onAdd={() => setBody((b) => addBlock(b))}
            onAddCategory={() => setBody((b) => addGroup(b))}
          />
          <BulkBar
            count={selectedChecks.size}
            onClear={clearChecks}
            onEnable={() => doBulk((b, ids) => bulkSetEnabled(b, ids, true), false)}
            onDisable={() => doBulk((b, ids) => bulkSetEnabled(b, ids, false), false)}
            onDuplicate={() => doBulk(bulkDuplicate, true)}
            onDelete={() => doBulk(bulkDelete, true)}
          />
          <BlockList
            blocks={shown}
            groups={body.groups}
            collapsedGroups={collapsedGroups}
            onToggleGroup={(id) => setCollapsedGroups((prev) => flip(prev, id))}
            totalBlocks={body.prompts.length}
            tab={tab}
            query={query}
            onClearQuery={() => setQuery("")}
            onShowAll={() => setTab("all")}
            selectedId={selectedId}
            selectedChecks={selectedChecks}
            expandedIds={expandedIds}
            onSelectRow={setSelectedId}
            onToggleCheck={toggleCheck}
            onToggleExpand={toggleExpand}
            onToggle={(id) => setBody((b) => toggleBlock(b, id))}
            onDelete={removeBlock}
            onReorder={(fromId, toIndex) =>
              setBody((b) => {
                // the row index is into the FILTERED view; moveBlock indexes the whole list
                const target = shown[toIndex];
                const real = target ? b.prompts.findIndex((p) => p.id === target.id) : -1;
                return moveBlock(b, fromId, real < 0 ? toIndex : real);
              })
            }
            onPatch={(id, patch) => setBody((b) => patchBlock(b, id, patch))}
            onAdd={() => setBody((b) => addBlock(b))}
          />
        </div>}
        /* the rail: per-BLOCK truth (RC's panel) or whole-PRESET truth (the engine's build) */
        right={<aside className={s.sidebar} aria-label="Preset rail">
          <div className={s.railTabs} role="tablist" aria-label="Rail view">
            {RAIL_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={rail === t.id}
                className={`${s.railTab} ${rail === t.id ? s.railTabOn : ""}`}
                onClick={() => setRail(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {rail === "edit" ? (
            <PromptEditPanel
              block={selectedBlock}
              stops={stops}
              writeFor={writeFor}
              groups={body.groups ?? []}
              onSetGroup={(groupId) => {
                if (selectedId) setBody((b) => setBlockGroup(b, selectedId, groupId));
              }}
              onClose={() => setSelectedId(null)}
              onPatch={(patch) => {
                if (selectedId) setBody((b) => patchBlock(b, selectedId, patch));
              }}
            />
          ) : (
            <LiveBuild
              body={body}
              onSelect={(id) => {
                setSelectedId(id);
                setRail("edit");
              }}
            />
          )}
        </aside>}
      />
    </div>
  );
}
