/**
 * ListToolbar - the prompt list's header (a port of RC's PromptListV4 toolbar): a search field, the
 * enabled/in-chat stats line, expand/collapse-all, and the All / Relative / In-Chat filter tabs
 * with their counts. Counts come from the WHOLE list, never the filtered view, so the badges stay
 * stable while you filter (RC does the same).
 */
import type { JSX } from "react";
import { ChevronsDownUp, ChevronsUpDown, FolderPlus, Plus, Search } from "lucide-react";
import {
  PROMPT_FILTER_LABELS,
  PROMPT_FILTER_TABS,
  type PromptCounts,
  type PromptFilterTab,
} from "../../../../core/preset";
import s from "./toolbar.module.css";

export interface ListToolbarProps {
  counts: PromptCounts;
  query: string;
  onQuery: (v: string) => void;
  tab: PromptFilterTab;
  onTab: (t: PromptFilterTab) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onAdd: () => void;
  onAddCategory: () => void;
}

const tabCount = (counts: PromptCounts, tab: PromptFilterTab): number =>
  tab === "all" ? counts.total : tab === "relative" ? counts.relative : counts.inchat;

export function ListToolbar({
  counts,
  query,
  onQuery,
  tab,
  onTab,
  onExpandAll,
  onCollapseAll,
  onAdd,
  onAddCategory,
}: ListToolbarProps): JSX.Element {
  return (
    <div className={s.toolbar}>
      <div className={s.topRow}>
        <div className={s.searchWrap}>
          <Search size={14} className={s.searchIcon} />
          <input
            className={s.search}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search prompts..."
            aria-label="Search prompts"
          />
        </div>

        <span className={s.stats}>
          <b className={s.statNum}>{counts.enabled}</b> enabled · <b className={s.statNum}>{counts.inchat}</b> in-chat
        </span>

        <div className={s.actions}>
          <button type="button" className={s.iconBtn} onClick={onExpandAll} title="Expand all" aria-label="Expand all">
            <ChevronsUpDown size={14} />
          </button>
          <button
            type="button"
            className={s.iconBtn}
            onClick={onCollapseAll}
            title="Collapse all"
            aria-label="Collapse all"
          >
            <ChevronsDownUp size={14} />
          </button>
          <button
            type="button"
            className={s.iconBtn}
            onClick={onAddCategory}
            title="New category"
            aria-label="New category"
          >
            <FolderPlus size={14} />
          </button>
          <button type="button" className={s.addBtn} onClick={onAdd}>
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      <div className={s.tabs} role="tablist" aria-label="Filter prompts">
        {PROMPT_FILTER_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`${s.tab} ${tab === t ? s.tabOn : ""}`}
            onClick={() => onTab(t)}
          >
            {PROMPT_FILTER_LABELS[t]}
            <span className={`${s.tabCount} ${tab === t ? s.tabCountOn : ""}`}>{tabCount(counts, t)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
