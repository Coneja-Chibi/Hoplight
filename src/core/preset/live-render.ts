/**
 * The RESOLVED live preview: buildPreview's engine-truth ordering, with each block's macro text
 * run through the closed-world interpreter (ADR-012 permits exactly this caller) and returned as
 * SEGMENTS that remember their authored source.
 *
 * This is the data layer of the editable preview: every segment carries (block id, source range),
 * so an edit to a literal segment is a splice of that block's `content` and nothing else, staged
 * through the normal save path. ./build.ts stays macro-literal on purpose - the manuscript's
 * weight/ordering view must not depend on a context or a seed; this module is for the pane where
 * somebody asked "what would this actually SAY".
 *
 * One context threads through all blocks in build order, so a `{{setvar}}` in an early block is
 * visible to a later one - the same order a real assembly would run them. Markers render as their
 * plain "splices in here" labels, never fake content.
 */
import type { PresetBody } from "../../entities/preset";
import { buildPreview, type PresetBuildLine } from "./build";
import {
  processMacros,
  type MacroContext,
  type MacroError,
  type RenderSegment,
} from "../macros";

export interface LiveRenderIdentity {
  characterName?: string;
  userName?: string;
  /** pin for reproducible rolls; reroll = new seed */
  randomSeed?: number;
  /** the clock as a value (epoch ms) - the UI reads it, this module never does (ADR-012) */
  now?: number;
  locale?: string;
  timezone?: string;
}

export interface LiveRenderLine extends PresetBuildLine {
  /** resolved output of this block's content (markers: the label, unrendered) */
  resolved: string;
  /** segments over the block's AUTHORED content; empty for markers */
  segments: RenderSegment[];
  errors: MacroError[];
}

export interface LiveRender {
  lines: LiveRenderLine[];
  /** true when any block rolled a volatile macro, i.e. a different seed changes the render */
  volatile: boolean;
}

/** Stub identity so `{{char}}`/`{{user}}` resolve without a loaded character (preview mode). */
const PREVIEW_CHARACTER = "Character";
const PREVIEW_USER = "User";

/**
 * The bucket-2 fixture: a chat that never happened, so chat macros show SOMETHING legitimate in
 * a preview (VAUDEVILLE's preview does the same). The `{{user}}` inside re-expands at render, so
 * the stub follows the identity it is previewed with.
 */
const PREVIEW_MESSAGES = [
  { role: "user", content: "{{user}}'s test message" },
  { role: "assistant", content: "{{char}}'s test reply" },
] as const;
const PREVIEW_CURRENT_MESSAGE = "test message";

export function renderLivePreview(body: PresetBody, identity: LiveRenderIdentity = {}): LiveRender {
  const context: MacroContext = {
    characterName: identity.characterName ?? PREVIEW_CHARACTER,
    userName: identity.userName ?? PREVIEW_USER,
    localVariables: new Map(),
    globalVariables: new Map(),
    randomSeed: identity.randomSeed ?? 1,
    now: identity.now,
    locale: identity.locale,
    timezone: identity.timezone,
    messages: [...PREVIEW_MESSAGES],
    currentMessage: PREVIEW_CURRENT_MESSAGE,
  };

  let volatile = false;
  const lines: LiveRenderLine[] = buildPreview(body).lines.map((line) => {
    if (line.isMarker) {
      return { ...line, resolved: line.text, segments: [], errors: [] };
    }
    const result = processMacros(line.text, context);
    if (!result.cacheable && result.sideEffects.length === 0) volatile = true;
    return { ...line, resolved: result.text, segments: result.segments, errors: result.errors };
  });

  return { lines, volatile };
}
