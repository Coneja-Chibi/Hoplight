/**
 * Tag-category presentation: the UI's read of the pure `categorizeTag` result (core/tag-taxonomy) - a
 * base color + a small line glyph per category, for the editor's tag chips. Categorization itself is
 * core; this is just how the editor draws each category. Lifted out of Editor.tsx (one presentation
 * concept, zero component deps).
 */
import type { JSX, ReactNode } from "react";
import type { TagCategory } from "../../../core/tag-taxonomy";

/** a smaller line glyph for tag chips (11px, sits before the tag text) */
const tglyph = (children: ReactNode): JSX.Element => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const TAG_CATEGORY_STYLE: Record<TagCategory, { color: string; icon: JSX.Element }> = {
  identity: { color: "#22d3ee", icon: tglyph(<><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1" /></>) }, // hardcode-ok: tag-category identity color, not theming
  trait: { color: "#a78bfa", icon: tglyph(<path d="M12 3l2.4 6H21l-5 4 1.9 6-5.9-4-5.9 4 1.9-6-5-4h6.6z" />) }, // hardcode-ok: tag-category identity color, not theming
  role: { color: "#fb7185", icon: tglyph(<><rect x="3" y="7" width="18" height="13" rx="1" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>) }, // hardcode-ok: tag-category identity color, not theming
  genre: { color: "#818cf8", icon: tglyph(<><path d="M12 6c-2-1.4-5-1.4-7 0v12c2-1.4 5-1.4 7 0 2-1.4 5-1.4 7 0V6c-2-1.4-5-1.4-7 0z" /><path d="M12 6v12" /></>) }, // hardcode-ok: tag-category identity color, not theming
  theme: { color: "#f472b6", icon: tglyph(<path d="M7 4h10v16l-5-4-5 4z" />) }, // hardcode-ok: tag-category identity color, not theming
  setting: { color: "#34d399", icon: tglyph(<><path d="M12 21s-6-5-6-10a6 6 0 0 1 12 0c0 5-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></>) }, // hardcode-ok: tag-category identity color, not theming
  pov: { color: "#38bdf8", icon: tglyph(<><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></>) }, // hardcode-ok: tag-category identity color, not theming
  mood: { color: "#fbbf24", icon: tglyph(<><circle cx="12" cy="12" r="9" /><path d="M8.5 14a4 4 0 0 0 7 0M9 10h.01M15 10h.01" /></>) }, // hardcode-ok: tag-category identity color, not theming
  kink: { color: "#f87171", icon: tglyph(<path d="M12 3s5 5 5 9a5 5 0 0 1-10 0c0-2 1-3.2 2-4 .4 2 3 1.6 3-5z" />) }, // hardcode-ok: tag-category identity color, not theming
  warning: { color: "#fb923c", icon: tglyph(<><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>) }, // hardcode-ok: tag-category identity color, not theming
  meta: { color: "#94a3b8", icon: tglyph(<path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />) }, // hardcode-ok: tag-category identity color, not theming
};
