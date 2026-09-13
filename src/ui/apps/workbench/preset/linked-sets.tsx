/** Studio-backed checklists for the regex and quick-reply sets a preset exports with. */
import { useEffect, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import s from "./linked-sets.module.css";

interface LinkedSetsProps {
  ctx: AppContext;
  behaviorRefs: readonly string[];
  quickReplyRefs: readonly string[];
  onBehaviorRefs: (ids: string[]) => void;
  onQuickReplyRefs: (ids: string[]) => void;
}

const toggle = (ids: readonly string[], id: string, checked: boolean): string[] =>
  checked ? [...new Set([...ids, id])] : ids.filter((item) => item !== id);

function Group({
  title,
  empty,
  rows,
  selected,
  onChange,
}: {
  title: string;
  empty: string;
  rows: readonly StudioEntitySummary[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
}): JSX.Element {
  return (
    <section className={s.group}>
      <h3 className={s.title}>{title}</h3>
      {rows.length === 0 ? <p className={s.empty}>{empty}</p> : (
        <div className={s.choices}>
          {rows.map((row) => (
            <label className={s.choice} key={`${row.kind}:${row.id}`}>
              <input
                type="checkbox"
                checked={selected.includes(row.id)}
                onChange={(event) => onChange(toggle(selected, row.id, event.target.checked))}
              />
              <span>{row.name}</span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

export function LinkedSets(props: LinkedSetsProps): JSX.Element {
  const [rows, setRows] = useState<StudioEntitySummary[]>([]);
  useEffect(() => {
    let live = true;
    void props.ctx.api.listEntities().then((items) => { if (live) setRows(items); }).catch(() => {});
    return () => { live = false; };
  }, [props.ctx.api]);
  return (
    <div className={s.groups}>
      <Group
        title="Regex sets"
        empty="No regex sets are in this studio."
        rows={rows.filter((row) => row.kind === "regex")}
        selected={props.behaviorRefs}
        onChange={props.onBehaviorRefs}
      />
      <Group
        title="Quick replies"
        empty="No quick-reply sets are in this studio."
        rows={rows.filter((row) => row.kind === "quickreply")}
        selected={props.quickReplyRefs}
        onChange={props.onQuickReplyRefs}
      />
    </div>
  );
}
