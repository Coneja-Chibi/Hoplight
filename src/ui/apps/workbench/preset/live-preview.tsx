/**
 * LivePreview - the RESOLVED rail pane, and the editable half the LiveBuild pane deliberately is
 * not. Renders core/preset `renderLivePreview(body)`: the same engine-truth build order, but with
 * macros resolved by the closed-world interpreter (ADR-012) against a stub identity and a pinned
 * seed. Every rendered span knows the authored characters it came from, so editing HERE saves
 * THERE: a literal span edit splices the owning block's content; a choice macro exposes its
 * branches, rolled one marked, each editable in place.
 *
 * All edit decisions are pure functions in core/preset/live-edit.ts (tested there); this file is
 * only the surface. A stale segment refuses to splice and says so - never a wrong-range write.
 */
import { useMemo, useState, type JSX } from "react";
import type { PresetBody } from "../../../../entities/preset";
import { renderLivePreview, type LiveRenderLine } from "../../../../core/preset/live-render";
import { editChoiceOption, spliceSegment } from "../../../../core/preset/live-edit";
import type { MacroSegment, RenderSegment } from "../../../../core/macros";
import { freshSeed } from "../../../../core/lore/rng";
import s from "./live-preview.module.css";

export interface LivePreviewProps {
  body: PresetBody;
  /** save an edited block content through the normal patch path (stays a draft until Save) */
  onPatchContent: (blockId: string, content: string) => void;
  /** jump the editor to a block */
  onSelect: (id: string) => void;
}

interface EditTarget {
  blockId: string;
  segIndex: number;
  /** -1 = the segment itself (literal text or whole macro expression); >=0 = a choice option */
  optionIndex: number;
}

const sameTarget = (a: EditTarget | null, b: EditTarget): boolean =>
  a !== null && a.blockId === b.blockId && a.segIndex === b.segIndex && a.optionIndex === b.optionIndex;

export function LivePreview({ body, onPatchContent, onSelect }: LivePreviewProps): JSX.Element {
  const [seed, setSeed] = useState(1);
  const [openMacro, setOpenMacro] = useState<{ blockId: string; segIndex: number } | null>(null);
  // editing identifies its span by (blockId, segIndex): sound while the rail shows ONE pane at a
  // time, so no other editor can move this block's segments under an open draft. A future split
  // view must add a content stamp here; spliceSegment's staleness guard is the backstop either way.
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState("");
  const [stale, setStale] = useState(false);

  // the clock crosses into the engine as a VALUE (ADR-012): read here, at the reroll boundary,
  // so a render is stable until the person asks for a fresh one
  const render = useMemo(() => {
    const intl = Intl.DateTimeFormat().resolvedOptions();
    return renderLivePreview(body, {
      randomSeed: seed,
      now: Date.now(),
      locale: intl.locale,
      timezone: intl.timeZone,
    });
  }, [body, seed]);

  const contentOf = (blockId: string): string =>
    body.prompts.find((p) => p.id === blockId)?.content ?? "";

  const beginEdit = (target: EditTarget, text: string): void => {
    setEditing(target);
    setDraft(text);
    setStale(false);
  };

  const commitEdit = (seg: RenderSegment): void => {
    if (!editing) return;
    const content = contentOf(editing.blockId);
    const next =
      editing.optionIndex >= 0 && seg.kind === "macro"
        ? (() => {
            const raw = editChoiceOption(seg, editing.optionIndex, draft);
            return raw === null ? null : spliceSegment(content, seg, raw);
          })()
        : spliceSegment(content, seg, draft);
    if (next === null) {
      setStale(true);
      return;
    }
    onPatchContent(editing.blockId, next);
    setEditing(null);
    setStale(false);
  };

  const cancelEdit = (): void => {
    setEditing(null);
    setStale(false);
  };

  const editorFor = (seg: RenderSegment, rows: number): JSX.Element => (
    <span className={s.editWrap}>
      <textarea
        className={s.editBox}
        value={draft}
        rows={rows}
        autoFocus
        aria-label="Edit this span"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commitEdit(seg);
          if (e.key === "Escape") cancelEdit();
        }}
      />
      <span className={s.editActs}>
        <button type="button" className={s.editSave} onClick={() => commitEdit(seg)}>
          save to block
        </button>
        <button type="button" className={s.editCancel} onClick={cancelEdit}>
          cancel
        </button>
        {stale ? <span className={s.staleNote}>the block changed under this preview - reroll and retry</span> : null}
      </span>
    </span>
  );

  const macroDetail = (line: LiveRenderLine, seg: MacroSegment, segIndex: number): JSX.Element => (
    <span className={s.detail}>
      <span className={s.detailRaw}>
        <span className={s.detailLabel}>source</span>
        {sameTarget(editing, { blockId: line.id, segIndex, optionIndex: -1 }) ? (
          editorFor(seg, 2)
        ) : (
          <button
            type="button"
            className={s.detailExpr}
            title="Edit the whole expression"
            onClick={() => beginEdit({ blockId: line.id, segIndex, optionIndex: -1 }, seg.raw)}
          >
            {seg.raw}
          </button>
        )}
      </span>
      {seg.detail?.kind === "choice" ? (
        <span className={s.options}>
          {seg.detail.options.map((opt, oi) => {
            const target = { blockId: line.id, segIndex, optionIndex: oi };
            const rolled = seg.detail?.kind === "choice" && seg.detail.chosenIndex === oi;
            return sameTarget(editing, target) ? (
              <span key={oi} className={s.optionEdit}>{editorFor(seg, 1)}</span>
            ) : (
              <button
                key={oi}
                type="button"
                className={`${s.option} ${rolled ? s.optionRolled : ""}`}
                title={rolled ? "This branch rolled - click to edit it" : "Click to edit this branch"}
                onClick={() => beginEdit(target, opt)}
              >
                {opt}
              </button>
            );
          })}
        </span>
      ) : null}
      {seg.detail?.kind === "branch" ? (
        <span className={s.branchNote}>took the {seg.detail.taken} branch</span>
      ) : null}
    </span>
  );

  const segmentSpan = (line: LiveRenderLine, seg: RenderSegment, segIndex: number): JSX.Element => {
    if (seg.kind === "literal") {
      const target = { blockId: line.id, segIndex, optionIndex: -1 };
      return sameTarget(editing, target) ? (
        editorFor(seg, Math.min(6, seg.value.split("\n").length + 1))
      ) : (
        <button
          type="button"
          className={s.lit}
          title="Click to edit this text - it saves to the block it came from"
          onClick={() => beginEdit(target, seg.value)}
        >
          {seg.value || " "}
        </button>
      );
    }
    const open = openMacro !== null && openMacro.blockId === line.id && openMacro.segIndex === segIndex;
    return (
      <>
        <button
          type="button"
          className={`${s.mac} ${open ? s.macOpen : ""}`}
          title={seg.raw}
          onClick={() => {
            setOpenMacro(open ? null : { blockId: line.id, segIndex });
            setEditing(null);
          }}
        >
          {seg.value || `⟨${seg.name}⟩`}
        </button>
        {open ? macroDetail(line, seg, segIndex) : null}
      </>
    );
  };

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <span className={s.headline}>resolved build</span>
        {render.volatile ? <span className={s.volatile}>volatile</span> : null}
        <button type="button" className={s.reroll} onClick={() => setSeed(freshSeed())} title="Roll the volatile macros again">
          reroll
        </button>
      </div>

      {render.lines.length === 0 ? (
        <p className={s.empty}>Nothing to preview. Enable a block.</p>
      ) : (
        <ol className={s.list}>
          {render.lines.map((line, i) => (
            <li key={line.id} className={s.line}>
              <button type="button" className={s.lineHead} onClick={() => onSelect(line.id)}>
                <span className={s.ord}>{String(i + 1).padStart(2, "0")}</span>
                <span className={s.lineName}>{line.name || "Untitled block"}</span>
                <span className={s.role}>{line.role}</span>
              </button>
              {line.isMarker ? (
                <pre className={s.markerText}>{line.resolved}</pre>
              ) : (
                <div className={s.flow}>
                  {line.segments.map((seg, si) => (
                    <span key={si} className={s.segSlot}>{segmentSpan(line, seg, si)}</span>
                  ))}
                </div>
              )}
              {line.errors.length > 0 ? (
                <p className={s.errs}>{line.errors.map((e) => e.message).join(" · ")}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <p className={s.note}>
        Resolved by the studio's own macro engine against a stub identity. Click rendered text to
        edit it where it lives; click a resolved macro to see its source and branches. Edits are
        drafts until you save the preset.
      </p>
    </div>
  );
}
