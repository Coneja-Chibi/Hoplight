/**
 * What the sealed preview will not draw - the list, and a pure reading of any markup against it.
 *
 * ONE AUTHORITY, TWO READERS. The list lived inside the React preview component, which meant the
 * only way to know whether something would survive the seal was to render it. Kit needs the same
 * answer BEFORE a regex is saved - a rule that emits a <button> writes a script whose output loses
 * its shape on every message, and finding that out by looking at a chat is the expensive way.
 *
 * PURE, and deliberately not DOMPurify. This module says what the policy FORBIDS, in a form a
 * terminal can read without a DOM. The sanitizer and the iframe CSP remain the enforcement; nothing
 * here is a security boundary, and a clean report is not a promise that arbitrary markup is safe.
 */

/** Tags the sealed preview strips. Elements go; the text inside them stays as bare text. */
export const SEALED_FORBID_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "link",
  "meta",
  "base",
  "frame",
  "frameset",
] as const;

export interface SealReport {
  /** Forbidden tag names present, each once, in the order the policy lists them. */
  readonly stripped: string[];
  /** http(s) references that cannot load: the CSP allows data: and blob: only. */
  readonly remote: string[];
  /** Event attributes, which never fire - scripts are off entirely. */
  readonly handlers: string[];
  /** True when nothing here would be removed or fail to load. */
  readonly clean: boolean;
}

const tagPresent = (html: string, tag: string): boolean =>
  new RegExp(`<${tag}\\b`, "i").test(html);

/**
 * Read markup against the seal. Text scanning, not parsing: this is advice for an author, and
 * over-reporting a tag named inside a code sample is a cheaper failure than missing a real one.
 */
export function readSeal(html: string): SealReport {
  const stripped = SEALED_FORBID_TAGS.filter((tag) => tagPresent(html, tag));
  const remote = [...new Set(html.match(/https?:\/\/[^\s"'()<>]+/gi) ?? [])].slice(0, 10);
  const handlers = [...new Set(
    (html.match(/\son[a-z]+\s*=/gi) ?? []).map((hit) => hit.trim().replace(/\s*=$/, "")),
  )].slice(0, 10);
  return {
    stripped: [...stripped],
    remote,
    handlers,
    clean: stripped.length === 0 && remote.length === 0 && handlers.length === 0,
  };
}

/** One line per problem, in the words an author needs, or an empty list when there is nothing. */
export function sealNotes(report: SealReport): string[] {
  const notes: string[] = [];
  if (report.stripped.length > 0) {
    notes.push(
      `stripped by the preview: ${report.stripped.join(", ")}. The text inside them survives as `
      + "bare text, so a control loses its shape and keeps its label - draw one with a styled "
      + "div or span instead.",
    );
  }
  if (report.remote.length > 0) {
    notes.push(
      `will not load (the frame allows data: and blob: only): ${report.remote.join(", ")}. `
      + "Inline an image as a data: URI, and use system fonts rather than a webfont.",
    );
  }
  if (report.handlers.length > 0) {
    notes.push(
      `never fires (scripts are off): ${report.handlers.join(", ")}. Show state in the markup `
      + "itself rather than through an interaction.",
    );
  }
  return notes;
}
