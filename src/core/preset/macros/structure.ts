/**
 * The STRUCTURAL facts a preset carries, computed so a reader never has to infer them.
 *
 * WHY THIS IS SEPARATE FROM ./transfer-check.ts. That module answers one narrow question - "does the
 * target engine have a macro of this name?" - and its header is emphatic about staying there. This
 * one answers a different question: what SHAPE is this preset's logic, so the person or model
 * finishing the conversion knows which of the four judgment calls they are looking at. Bolting the
 * second onto the first would blur a boundary that was drawn deliberately.
 *
 * THE DIVISION OF LABOUR. The engine computes facts; the model does the judgment. A dead
 * `{{choice::language_selector}}` is a fact, and so is the list of options that choice group
 * declares. Deciding whether to seed it as a variable, expand it inline, or drop it is judgment, and
 * this module does not attempt it. Everything here is countable from the preset itself.
 *
 * NOTHING IS EVALUATED. Text is scanned and YAML is read as declarations. No hook runs, no condition
 * resolves, no macro expands, so ADR-012 does not reach this file.
 *
 * ON ZERO VERSUS UNKNOWN. A RoleCall preset's hook machine lives ONLY in escrow
 * (`original.rolecall.raw.macro_engine_yaml`); it is not part of the canonical body. A piece whose
 * escrow was dropped therefore cannot be distinguished from one that never had hooks - unless the
 * report says so. `stateLayer` carries that distinction, exactly like `checked:false` does next
 * door, because "no hooks found" read as "no hooks exist" is the failure this design prevents.
 */
import { MARKER_LABELS } from "../build";
import { macroName, scanMacroTokens } from "./support";
import { censusConditionals, readStateMachine, type StateHook } from "./state-machine";

/** An array-shaped variable: one name addressed by index. */
export interface ArrayFinding {
  name: string;
  /** Indices written or read as literals, sorted. These are the slots that lower to plain names. */
  literalIndices: number[];
  /** Accesses whose index is itself a macro. These lower to a COMPOSED name, not a fixed one. */
  dynamicAccesses: number;
}

/** A variable whose every written value was a short literal, so its range of values is known. */
export interface DomainFinding {
  variable: string;
  values: string[];
}

/**
 * A domain is only useful if it can be expanded inline, so the values have to be identifiers rather
 * than prose. Measured, not guessed: the real preset assigns twelve ~300-character passages to one
 * variable, which is literal, enumerable, and completely useless as a domain - reporting it buried
 * every other finding under 46KB of text. Variables past these bounds are NAMED in `wideVariables`
 * instead of being dropped in silence.
 */
const MAX_DOMAIN_VALUE_CHARS = 60;
const MAX_DOMAIN_VALUES = 24;

/** A hook that appends to a list, which a target without lists must catch some other way. */
export interface PushHookFinding {
  id: string;
  /** The regex source as authored, verbatim: writing a catcher needs the pattern, not a summary. */
  trigger: string;
  flags: string;
  variable: string;
  placement: string[];
  strip: boolean;
}

/** A dead macro whose name resembles a structural slot the canonical model already has. */
export interface MarkerCandidate {
  token: string;
  where: string;
  /** The canonical marker slot, from the model's own list. */
  markerSlot: string;
  /** The word the two names share. Stated so a reader can dismiss a bad guess at a glance. */
  sharedWord: string;
}

/** A `{{choice::x}}` reference resolved against the preset's own declared choice group. */
export interface ChoiceFinding {
  token: string;
  where: string;
  /** The choice group's key or id, as referenced. */
  reference: string;
  /** Null when the reference matches no declared group, which is itself worth knowing. */
  label: string | null;
  /** The declared options, which are exactly the values a seeded variable would take. */
  options: { id: string; label: string; value?: string }[];
  /** The group's declared default, when it has one. */
  defaultValue?: string;
}

export interface StructuralFindings {
  /**
   * `read`     the hook machine was present and parsed;
   * `absent`   escrow was present and carried no hook machine;
   * `unknown`  no escrow to read, so the presence of hooks cannot be determined either way.
   */
  stateLayer: "read" | "absent" | "unknown";
  hookCount: number;
  /** Lines the YAML reader could not classify, so `hookCount` is never read as complete. */
  hookLinesUnparsed: number;
  pushHooks: PushHookFinding[];
  conditionals: { openers: number; closers: number; elses: number };
  arrays: ArrayFinding[];
  domains: DomainFinding[];
  /**
   * Variables written only with literals, but with values too long or too many to expand inline.
   * Named rather than omitted: a bounded report that hides what it bounded reads as completeness.
   */
  wideVariables: string[];
  markerCandidates: MarkerCandidate[];
  choices: ChoiceFinding[];
  /** Caveats that travel with the result. Never dropped by a caller. */
  limits: string[];
}

const SCOPE_LIMIT =
  "Scanned prompt block content only, which is the same surface the translator rewrites. Group "
  + "content, system prompts, and macro text inside escrowed platform-native fields were not "
  + "scanned, so counts here describe the converted surface rather than the whole file.";

const DOMAIN_LIMIT =
  "A domain is reported only when EVERY write to that variable was a literal in scanned text. One "
  + "computed write elsewhere would widen it, so treat a domain as the known values, not a proof of "
  + "the only values.";

const MARKER_LIMIT =
  "Marker candidates are name-similarity guesses, not equivalences. Each names the word it matched "
  + "on so a wrong guess is obvious; confirm against what the block actually renders.";

/** Every prompt block's authored text with a readable location. */
function presetTexts(body: unknown): { text: string; where: string }[] {
  const prompts = (body as { prompts?: unknown })?.prompts;
  if (!Array.isArray(prompts)) return [];
  const out: { text: string; where: string }[] = [];
  prompts.forEach((prompt, index) => {
    const row = (prompt ?? {}) as { content?: unknown; name?: unknown; id?: unknown };
    if (typeof row.content !== "string" || row.content.length === 0) return;
    const label = typeof row.name === "string" && row.name
      ? row.name
      : typeof row.id === "string" && row.id
        ? row.id
        : `block ${index}`;
    out.push({ text: row.content, where: label });
  });
  return out;
}

/** Split on `::` at brace depth zero, so a nested macro argument stays whole. */
function splitArgs(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] === "{" && inner[i + 1] === "{") { depth += 1; i += 1; continue; }
    if (inner[i] === "}" && inner[i + 1] === "}") { depth -= 1; i += 1; continue; }
    if (depth === 0 && inner[i] === ":" && inner[i + 1] === ":") {
      parts.push(inner.slice(start, i));
      i += 1;
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts;
}

/** Indexed accesses, grouped into the arrays they address. */
function findArrays(texts: readonly { text: string; where: string }[]): ArrayFinding[] {
  const arrays = new Map<string, { literal: Set<number>; dynamic: number }>();
  for (const { text } of texts) {
    for (const token of scanMacroTokens(text)) {
      const name = macroName(token);
      if (name !== "getvarkey" && name !== "setvarkey") continue;
      const [, array, index] = splitArgs(token.slice(2, -2)).map((part) => part.trim());
      if (!array || index === undefined) continue;
      const entry = arrays.get(array) ?? { literal: new Set<number>(), dynamic: 0 };
      if (/^\d+$/.test(index)) entry.literal.add(Number(index));
      else entry.dynamic += 1;
      arrays.set(array, entry);
    }
  }
  return [...arrays.entries()]
    .map(([name, entry]) => ({
      name,
      literalIndices: [...entry.literal].sort((a, b) => a - b),
      dynamicAccesses: entry.dynamic,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One state write: the variable it targets, and the literal value when it wrote a plain one. */
interface VariableWrite {
  variable: string;
  /** Null whenever the written value is computed, which opens the variable's domain. */
  literal: string | null;
}

/**
 * The state write a token performs, across EVERY form that writes.
 *
 * Scanning only `{{setvar}}` is not enough and the miss is not merely incomplete, it is wrong. In one
 * real preset three variables looked like closed domains of a single value while `{{incvar}}` and
 * `{{addvar}}` were also driving them; reported as closed, a reader would expand a running counter
 * into the constant zero. Any write form that is not a plain literal assignment has to open the
 * domain, so all of them have to be recognised.
 */
function writeIn(token: string): VariableWrite | null {
  const inner = token.slice(2, -2);

  // Shorthand assignment: {{.x = v}}, {{$x += v}}, {{.x++}}. `=(?!=)` is what keeps the comparison
  // `{{.x == v}}` out; it reads state and must not be mistaken for a write. Only a bare `=` can
  // carry a literal, since every compound operator derives the new value from the current one.
  const shorthand = /^\s*[.$]([A-Za-z_][A-Za-z0-9_]*)\s*(\+\+|--|\+=|-=|\|\|=|\?\?=|=(?!=))([\s\S]*)$/
    .exec(inner);
  if (shorthand) {
    const [, variable, operator, rest] = shorthand;
    const value = (rest ?? "").trim();
    const plain = operator === "=" && value.length > 0 && !value.includes("{{");
    return { variable: variable!, literal: plain ? value : null };
  }

  const name = macroName(token);
  if (!name) return null;
  const args = splitArgs(inner).map((part) => part.trim());
  const variable = args[1];
  if (!variable) return null;

  if (name === "setvar" || name === "setglobalvar") {
    const value = args.slice(2).join("::");
    return { variable, literal: value.length > 0 && !value.includes("{{") ? value : null };
  }
  // Arithmetic and append forms always derive from the current value, so they can never close a set.
  if (/^(add|inc|dec)(global)?var$/.test(name)) return { variable, literal: null };
  return null;
}

/**
 * Variables whose written values are all literal. A single computed write disqualifies the variable
 * entirely rather than reporting a partial list, because a partial list presented as a domain is
 * what would make a reader expand it wrongly.
 */
function findDomains(
  texts: readonly { text: string; where: string }[],
): { domains: DomainFinding[]; wideVariables: string[] } {
  const literals = new Map<string, Set<string>>();
  const computed = new Set<string>();
  for (const { text } of texts) {
    for (const token of scanMacroTokens(text)) {
      const write = writeIn(token);
      if (!write) continue;
      if (write.literal === null) { computed.add(write.variable); continue; }
      literals.set(write.variable, (literals.get(write.variable) ?? new Set<string>()).add(write.literal));
    }
  }

  const domains: DomainFinding[] = [];
  const wideVariables: string[] = [];
  for (const [variable, valueSet] of literals) {
    if (computed.has(variable)) continue;
    const values = [...valueSet].sort();
    const expandable =
      values.length <= MAX_DOMAIN_VALUES
      && values.every((value) => value.length <= MAX_DOMAIN_VALUE_CHARS);
    if (expandable) domains.push({ variable, values });
    else wideVariables.push(variable);
  }
  return {
    domains: domains.sort((a, b) => a.variable.localeCompare(b.variable)),
    wideVariables: wideVariables.sort(),
  };
}

/** Words worth matching on: short ones ("of", "id") would pair almost anything with anything. */
const wordsOf = (name: string): string[] =>
  name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z]+/)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length >= 4);

/**
 * Dead macros whose names resemble a canonical marker slot. The slot list comes from the model's own
 * MARKER_LABELS rather than being restated here, so a slot added there appears without an edit.
 */
function findMarkerCandidates(
  deadTokens: readonly { token: string; where: string }[],
): MarkerCandidate[] {
  const slots = Object.keys(MARKER_LABELS).map((slot) => ({ slot, words: new Set(wordsOf(slot)) }));
  const out: MarkerCandidate[] = [];
  for (const { token, where } of deadTokens) {
    const name = macroName(token);
    if (!name) continue;
    for (const word of wordsOf(name)) {
      const hit = slots.find((slot) => slot.words.has(word));
      if (!hit) continue;
      out.push({ token, where, markerSlot: hit.slot, sharedWord: word });
      break;
    }
  }
  return out;
}

/** `{{choice::x}}` references resolved against the preset's own declared choice groups. */
function findChoices(
  body: unknown,
  texts: readonly { text: string; where: string }[],
): ChoiceFinding[] {
  const declared = (body as { choices?: unknown })?.choices;
  const groups = Array.isArray(declared) ? declared : [];
  const out: ChoiceFinding[] = [];
  for (const { text, where } of texts) {
    for (const token of scanMacroTokens(text)) {
      if (macroName(token) !== "choice") continue;
      const reference = (splitArgs(token.slice(2, -2))[1] ?? "").trim();
      if (!reference) continue;
      const group = groups.find((candidate) => {
        const row = (candidate ?? {}) as { id?: unknown; key?: unknown };
        return row.key === reference || row.id === reference;
      }) as { label?: unknown; options?: unknown; default?: unknown } | undefined;
      const options = Array.isArray(group?.options) ? group.options : [];
      out.push({
        token,
        where,
        reference,
        label: typeof group?.label === "string" ? group.label : null,
        options: options.map((option) => {
          const row = (option ?? {}) as { id?: unknown; label?: unknown; value?: unknown };
          return {
            id: typeof row.id === "string" ? row.id : "",
            label: typeof row.label === "string" ? row.label : "",
            ...(typeof row.value === "string" ? { value: row.value } : {}),
          };
        }),
        ...(typeof group?.default === "string" ? { defaultValue: group.default } : {}),
      });
    }
  }
  return out;
}

/** The RoleCall hook machine, which lives in escrow rather than the canonical body. */
function escrowedStateYaml(entity: unknown): { present: boolean; yaml: unknown } {
  const original = (entity as { original?: Record<string, unknown> })?.original;
  if (!original || typeof original !== "object") return { present: false, yaml: undefined };
  for (const slot of Object.values(original)) {
    const raw = (slot as { raw?: unknown })?.raw;
    if (raw && typeof raw === "object" && "macro_engine_yaml" in raw) {
      return { present: true, yaml: (raw as { macro_engine_yaml?: unknown }).macro_engine_yaml };
    }
  }
  return { present: Object.keys(original).length > 0, yaml: undefined };
}

const pushHooksOf = (hooks: readonly StateHook[]): PushHookFinding[] =>
  hooks.flatMap((hook) =>
    hook.actions
      .filter((action) => action.type === "push")
      .map((action) => ({
        id: hook.id,
        trigger: hook.trigger,
        flags: hook.flags,
        variable: action.key,
        placement: hook.placement,
        strip: hook.strip,
      })),
  );

/**
 * Read one stored preset's structural shape.
 *
 * Takes the ENTITY, not the body, because the hook machine is escrow-only. `deadTokens` are the
 * macros a transfer check already found have no home on the target; they are passed in rather than
 * recomputed so this module never has to know what a target engine is.
 */
export function readPresetStructure(
  entity: unknown,
  deadTokens: readonly { token: string; where: string }[] = [],
): StructuralFindings {
  const body = (entity as { body?: unknown })?.body ?? entity;
  const texts = presetTexts(body);
  const escrow = escrowedStateYaml(entity);
  const machine = readStateMachine(escrow.yaml);
  const census = censusConditionals(texts.map((row) => row.text));
  const { domains, wideVariables } = findDomains(texts);

  const stateLayer: StructuralFindings["stateLayer"] = escrow.yaml !== undefined
    ? "read"
    : escrow.present
      ? "absent"
      : "unknown";

  const limits = [SCOPE_LIMIT, DOMAIN_LIMIT, MARKER_LIMIT];
  if (stateLayer === "unknown") {
    limits.push(
      "This piece carries no escrow, so whether it ever had a hook machine cannot be determined. "
      + "A hook count of zero here is not a claim that there are no hooks.",
    );
  }

  return {
    stateLayer,
    hookCount: machine.hooks.length,
    hookLinesUnparsed: machine.unparsedLines,
    pushHooks: pushHooksOf(machine.hooks),
    conditionals: { openers: census.openers, closers: census.closers, elses: census.elses },
    arrays: findArrays(texts),
    domains,
    wideVariables,
    markerCandidates: findMarkerCandidates(deadTokens),
    choices: findChoices(body, texts),
    limits,
  };
}
