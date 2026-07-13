/**
 * BlockContent - the inline content editor revealed when a row's caret is expanded (RC's split:
 * content inline, metadata in the right EDIT PROMPT sidebar). A plain textarea for now; the
 * CodeEditor + macro autocomplete is a later polish slice.
 */
import type { JSX } from "react";
import type { PresetPrompt } from "../../../../entities/preset";
import { blockTokens } from "../../../../core/preset";
import es from "../editor-styles";
import s from "./preset.module.css";

export interface BlockContentProps {
  block: PresetPrompt;
  onPatch: (patch: Partial<PresetPrompt>) => void;
}

export function BlockContent({ block, onPatch }: BlockContentProps): JSX.Element {
  return (
    <div className={s.content}>
      <textarea
        className={`${es.in} ${es.ta} ${s.contentTa}`}
        value={block.content}
        placeholder="Block content. Macros like {{getvar::X}} stay literal - a runtime resolves them."
        aria-label="Block content"
        onChange={(e) => onPatch({ content: e.target.value })}
      />
      <div className={s.contentFoot}>
        ~{blockTokens(block)} tokens · {block.content.length} chars
      </div>
    </div>
  );
}
