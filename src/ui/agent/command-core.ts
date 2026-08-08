/**
 * The wire between Kit's slash commands and the window: what a command IS, and what running one DID.
 *
 * WHY A WIRE AT ALL. Kit's commands are drop-in files that reach the vault, the studio bridge, the
 * grant book and the OS clipboard. None of that exists in a browser, so the commands cannot be
 * imported into the page - and rewriting them for the window would be a second copy of every rule
 * they encode, which is the duplicated-authority defect this repo keeps paying for.
 *
 * So the command RUNS SERVER-SIDE, against a real CommandContext whose actions are RECORDED rather
 * than performed, and what comes back is this list of effects. `ctx.say` becomes a `say` effect the
 * window appends; `ctx.openSettings` becomes a `settings` effect the window navigates on. That is
 * the browser CommandContext the window needs - it is simply split across the loopback, with the
 * half that decides living beside Kit and the half that draws living here.
 *
 * MATCHING STILL HAPPENS IN THE PAGE, with Kit's own `matchCommand`, so a line that is a command
 * never becomes a turn and never reaches a model. That needs the command list, which is what
 * CommandInfo carries.
 *
 * Every shape here crosses a boundary twice (server to page, and page to sessionStorage), so it is
 * parsed rather than trusted, the way readChoices already is.
 */
import type { KitCommand } from "../../kit/commands/command";

/** One command, as the window is allowed to know it. No `run`: running is the server's half. */
export interface CommandInfo {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly summary: string;
  /** Which help section it files under. Absent falls to Other, exactly as Kit's help does. */
  readonly group?: string;
  /** Whether this command offers candidates for its ARGUMENT, so the popup knows to ask for them. */
  readonly completes: boolean;
}

/** A row in a listing widget: what it is, what it says, and what choosing it does. */
export interface WidgetRow {
  readonly label: string;
  readonly note?: string;
  /** Chosen: this line goes through the composer's send path, command interception and all. */
  readonly send?: string;
  /**
   * Chosen: keep this many turns of the window's OWN transcript and drop the rest.
   *
   * Local, and nothing is written to disk. Kit's rewind rail edits a saved session file; the window's
   * conversation is not one, so the honest equivalent is scrubbing back through what is on screen.
   */
  readonly keep?: number;
}

/** One picture. A `data:` URL because the window's CSP allows `data:` images and no other source. */
export interface WidgetImage {
  readonly src: string;
  readonly caption?: string;
}

/** One diagnostic row, as the doctor reported it. */
export interface DoctorRow {
  readonly label: string;
  readonly status: "ok" | "warn" | "fail";
  readonly detail: string;
}

/** What a command drew, when it drew something other than a paragraph. */
export type KitWidget =
  | { readonly kind: "rows"; readonly rows: readonly WidgetRow[]; readonly hint?: string }
  | { readonly kind: "doctor"; readonly rows: readonly DoctorRow[] }
  | { readonly kind: "images"; readonly images: readonly WidgetImage[] };

/** Everything running one command can have done. */
export type CommandEffect =
  /** Markdown into the transcript. Kit's `ctx.say`. */
  | { readonly kind: "say"; readonly text: string }
  /** A titled listing: /help, /tools, /session, the rewind picker. */
  | { readonly kind: "rows"; readonly title: string; readonly rows: readonly WidgetRow[]; readonly hint?: string }
  /** The diagnostic playbill. */
  | { readonly kind: "doctor"; readonly rows: readonly DoctorRow[] }
  /** A picture or a shelf of them: /image, /art, /gallery. */
  | { readonly kind: "images"; readonly title: string; readonly images: readonly WidgetImage[] }
  /** Replace the window's conversation. /resume, and the rewind picker's rows. */
  | { readonly kind: "transcript"; readonly lines: readonly { readonly role: "user" | "assistant"; readonly text: string }[] }
  /** Open provider setup. Kit's `ctx.openSettings`. */
  | { readonly kind: "settings" }
  /** Leave. Kit's `ctx.quit`, which in a browser can only mean closing the panel. */
  | { readonly kind: "close" };

/**
 * A line the SHELL put in the transcript, as opposed to one anybody said.
 *
 * ITS OWN ROLE, and this is the load-bearing part. A command's output is not the model's words and
 * must never be posted back as though it were: `/decks` listing somebody's studio would otherwise
 * ride into the next request as an assistant message the model never wrote, and the model would then
 * be arguing with a receipt. The send path filters this role out of what it posts, the same way it
 * already filters tool narration.
 */
export interface KitLine {
  readonly role: "kit";
  readonly text: string;
  readonly widget?: KitWidget;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

/**
 * Every command Kit has, as objects `matchCommand` accepts.
 *
 * THE `run` IS DELIBERATELY DEAD. `matchCommand` reads only `name` and `aliases`, but its signature
 * takes a whole KitCommand and forking it to take less would leave the window matching by a second
 * set of rules - the exact drift the matcher exists to prevent. `false` is already Kit's word for
 * "this side did not handle it" (see render/run-command.ts), which is true: the real `run` is the
 * one on disk, executed server-side against a recording context.
 */
export function asKitCommands(catalog: readonly CommandInfo[]): KitCommand[] {
  return catalog.map((info) => ({
    name: info.name,
    ...(info.aliases ? { aliases: info.aliases } : {}),
    summary: info.summary,
    ...(info.group ? { group: info.group } : {}),
    run: () => false,
  }));
}

/** Read a catalog off the wire, dropping anything that is not a usable command. */
export function parseCatalog(value: unknown): CommandInfo[] {
  const raw = isRecord(value) ? value["commands"] : undefined;
  if (!Array.isArray(raw)) return [];
  const out: CommandInfo[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const name = str(item["name"]);
    const summary = str(item["summary"]);
    // A command word must start with a slash, or the matcher could never reach it and the popup
    // would offer something untypeable.
    if (!name || !name.startsWith("/") || !summary) continue;
    const aliases = Array.isArray(item["aliases"])
      ? item["aliases"].filter((a): a is string => typeof a === "string" && a.startsWith("/"))
      : [];
    const group = str(item["group"]);
    out.push({
      name,
      ...(aliases.length > 0 ? { aliases } : {}),
      summary,
      ...(group ? { group } : {}),
      completes: item["completes"] === true,
    });
  }
  return out;
}

/** Argument candidates off the wire. Same rule: a malformed one is dropped, never coerced. */
export function parseSuggestions(value: unknown): { value: string; note?: string }[] {
  const raw = isRecord(value) ? value["suggestions"] : undefined;
  if (!Array.isArray(raw)) return [];
  const out: { value: string; note?: string }[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const text = str(item["value"]);
    if (!text) continue;
    const note = str(item["note"]);
    out.push({ value: text, ...(note ? { note } : {}) });
  }
  return out;
}

const parseRows = (raw: unknown): WidgetRow[] => {
  if (!Array.isArray(raw)) return [];
  const rows: WidgetRow[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const label = str(item["label"]);
    if (!label) continue;
    const note = str(item["note"]);
    const send = str(item["send"]);
    const keep = item["keep"];
    rows.push({
      label,
      ...(note ? { note } : {}),
      ...(send ? { send } : {}),
      ...(typeof keep === "number" && Number.isInteger(keep) && keep >= 0 ? { keep } : {}),
    });
  }
  return rows;
};

const parseDoctorRows = (raw: unknown): DoctorRow[] => {
  if (!Array.isArray(raw)) return [];
  const rows: DoctorRow[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const label = str(item["label"]);
    const status = item["status"];
    if (!label || (status !== "ok" && status !== "warn" && status !== "fail")) continue;
    rows.push({ label, status, detail: str(item["detail"]) ?? "" });
  }
  return rows;
};

const parseImages = (raw: unknown): WidgetImage[] => {
  if (!Array.isArray(raw)) return [];
  const images: WidgetImage[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const src = str(item["src"]);
    /**
     * DATA URLS ONLY. This string becomes an `img src`, so it is the one field on this wire that a
     * browser will go and act on. The CSP already refuses every other scheme; refusing them here as
     * well means a malformed payload is dropped rather than becoming a blocked request nobody can
     * explain, and it keeps `javascript:` from ever being written into the DOM in the first place.
     */
    if (!src || !src.startsWith("data:image/")) continue;
    const caption = str(item["caption"]);
    images.push({ src, ...(caption ? { caption } : {}) });
  }
  return images;
};

const parseTranscriptLines = (raw: unknown): { role: "user" | "assistant"; text: string }[] => {
  if (!Array.isArray(raw)) return [];
  const lines: { role: "user" | "assistant"; text: string }[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const role = item["role"];
    const text = item["text"];
    if ((role !== "user" && role !== "assistant") || typeof text !== "string") continue;
    lines.push({ role, text });
  }
  return lines;
};

/**
 * Read a widget back off a line.
 *
 * A SECOND CROSSING. A widget arrives from the server, is drawn, and is then written into
 * sessionStorage, which anything on the machine can edit. Coming back it is data from outside the
 * program again, so it is read again rather than trusted because it was ours once.
 */
export function parseWidget(value: unknown): KitWidget | null {
  if (!isRecord(value)) return null;
  switch (value["kind"]) {
    case "rows": {
      const hint = str(value["hint"]);
      return { kind: "rows", rows: parseRows(value["rows"]), ...(hint ? { hint } : {}) };
    }
    case "doctor":
      return { kind: "doctor", rows: parseDoctorRows(value["rows"]) };
    case "images": {
      const images = parseImages(value["images"]);
      return images.length > 0 ? { kind: "images", images } : null;
    }
    default:
      return null;
  }
}

/**
 * Read the effect list off the wire.
 *
 * UNKNOWN KINDS ARE DROPPED, not rendered. An older page talking to a newer server is the ordinary
 * case for a desktop app mid-update, and a kind nothing can draw must be nothing rather than an
 * empty band or a thrown render.
 */
export function parseEffects(value: unknown): CommandEffect[] {
  const raw = isRecord(value) ? value["effects"] : undefined;
  if (!Array.isArray(raw)) return [];
  const out: CommandEffect[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    switch (item["kind"]) {
      case "say": {
        const text = str(item["text"]);
        if (text) out.push({ kind: "say", text });
        break;
      }
      case "rows": {
        const rows = parseRows(item["rows"]);
        const hint = str(item["hint"]);
        out.push({ kind: "rows", title: str(item["title"]) ?? "", rows, ...(hint ? { hint } : {}) });
        break;
      }
      case "doctor":
        out.push({ kind: "doctor", rows: parseDoctorRows(item["rows"]) });
        break;
      case "images": {
        const images = parseImages(item["images"]);
        if (images.length > 0) out.push({ kind: "images", title: str(item["title"]) ?? "", images });
        break;
      }
      case "transcript":
        out.push({ kind: "transcript", lines: parseTranscriptLines(item["lines"]) });
        break;
      case "settings":
        out.push({ kind: "settings" });
        break;
      case "close":
        out.push({ kind: "close" });
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * The first `keep` turns of a transcript, where a turn starts at something the person said.
 *
 * WHAT THE REWIND PICKER DOES. Kit's rewind rail counts turns of a saved session; the window's
 * conversation is not a saved session, so the same count is taken off the lines on screen. Anything
 * before the first thing anybody said - a restored greeting, a command's output - belongs to no turn
 * and is dropped with the rest, which is what "keep nothing" has to mean for it to be a real reset.
 */
export function keepTurns<T extends { readonly role: string }>(
  lines: readonly T[],
  keep: number,
): T[] {
  if (keep <= 0) return [];
  let seen = 0;
  for (let at = 0; at < lines.length; at += 1) {
    if (lines[at]?.role !== "user") continue;
    seen += 1;
    // The line that would OPEN turn keep+1 is where this stops: everything before it is the first
    // `keep` turns, complete with their replies.
    if (seen > keep) return lines.slice(0, at);
  }
  return [...lines];
}

/**
 * The transcript line one effect leaves behind, or null when the effect is not a line at all.
 *
 * Navigation and transcript replacement are not lines: opening Settings should not also narrate
 * itself into a log that is meant to be the conversation.
 */
export function kitLineFor(effect: CommandEffect): KitLine | null {
  switch (effect.kind) {
    case "say":
      return { role: "kit", text: effect.text };
    case "rows":
      return { role: "kit", text: effect.title, widget: { kind: "rows", rows: effect.rows, ...(effect.hint ? { hint: effect.hint } : {}) } };
    case "doctor":
      return { role: "kit", text: "Doctor", widget: { kind: "doctor", rows: effect.rows } };
    case "images":
      return { role: "kit", text: effect.title, widget: { kind: "images", images: effect.images } };
    default:
      return null;
  }
}
