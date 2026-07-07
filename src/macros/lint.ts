// ============================================================================
// MACRO LINT (macro engine spec Part IV.7) — static analysis v1
//
// Pure JS, runs in-browser. Catches author mistakes before the model ever
// sees them:
//
//   - unknown macros (with did-you-mean suggestions)
//   - unbalanced {{if}} / {{/if}} blocks
//   - reads of variables nothing ever sets (dangling references)
//   - {{enabled}}/{{when_enabled}}/{{include}} pointing at unknown prompts
//   - {{use_template}} without a {{template}} definition
//   - {{override}} declared after the {{block}} it targets (ordering)
//
// Surfacing (editor squigglies / save panel) is a UI concern; this module
// only produces findings.
// ============================================================================

import { getMacro, getAllMacros } from './registry';
import { parseMacroEngineConfig } from './hooks';
import { resolveVariableTarget } from './scopes';

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintFinding {
  severity: LintSeverity;
  /** Stable rule id, e.g. "unknown-macro" */
  rule: string;
  message: string;
  /** Prompt the finding is in (identifier) */
  promptId?: string;
  /** The offending macro text, when applicable */
  macro?: string;
}

export interface LintPromptInput {
  identifier: string;
  name?: string;
  content: string;
  enabled?: boolean;
}

export interface LintInput {
  prompts: LintPromptInput[];
  /** presets.settings.macro_engine / macro_engine_yaml, if any */
  macroEngineConfig?: unknown;
}

// -----------------------------------------------------------------------------
// Macro scanning
// -----------------------------------------------------------------------------

interface ScannedMacro {
  name: string;
  args: string[];
  raw: string;
}

/** Find the `}}` closing the `{{` at openPos, or -1. */
function findClose(text: string, openPos: number): number {
  let depth = 0;
  for (let i = openPos; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; }
    else if (text[i] === '}' && text[i + 1] === '}') {
      depth--;
      if (depth === 0) return i;
      i++;
    }
  }
  return -1;
}

/** Split macro content on top-level `::`. */
function splitArgs(content: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{' && content[i + 1] === '{') { depth++; current += '{{'; i++; }
    else if (content[i] === '}' && content[i + 1] === '}') { depth--; current += '}}'; i++; }
    else if (content[i] === ':' && content[i + 1] === ':' && depth === 0) {
      parts.push(current); current = ''; i++;
    } else current += content[i];
  }
  parts.push(current);
  return parts;
}

/** Scan all macros in a text, including nested ones, in source order. */
export function scanMacros(text: string): ScannedMacro[] {
  const out: ScannedMacro[] = [];
  const walk = (t: string) => {
    let pos = 0;
    while (pos < t.length) {
      const open = t.indexOf('{{', pos);
      if (open === -1) break;
      const close = findClose(t, open);
      if (close === -1) break;
      const inner = t.slice(open + 2, close);
      const trimmed = inner.trim();
      if (!trimmed.startsWith('//')) {
        const parts = splitArgs(inner);
        out.push({
          name: parts[0].trim().toLowerCase(),
          args: parts.slice(1).map(a => a.trim()),
          raw: `{{${inner}}}`,
        });
        // Recurse into args for nested macros
        for (const arg of parts.slice(1)) {
          if (arg.includes('{{')) walk(arg);
        }
      }
      pos = close + 2;
    }
  };
  walk(text);
  return out;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Names valid in block syntax or handled by the parser, not the registry. */
const STRUCTURAL_NAMES = new Set([
  '/if', 'endif', '/#if', 'else', '/setvar', '/setglobalvar',
]);

/** Names that don't need to resolve: block-if heads, dot/space syntax. */
function isStructural(name: string): boolean {
  if (STRUCTURAL_NAMES.has(name)) return true;
  if (name.startsWith('#if') || name.startsWith('if ')) return true;
  if (name.startsWith('.') || name.startsWith('$')) return true; // dot/global shorthand
  return false;
}

function levenshteinish(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let diff = Math.abs(a.length - b.length);
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) diff++;
  return diff;
}

function suggestMacro(name: string): string | null {
  let best: string | null = null;
  let bestScore = 3;
  for (const def of getAllMacros()) {
    const score = levenshteinish(name, def.name);
    if (score < bestScore) { bestScore = score; best = def.name; }
  }
  return best;
}

/** Macros that READ a variable named by their first arg. */
const VAR_READERS = new Set([
  'getvar', 'var', 'hasvar', 'state.get', 'has', 'is_empty', 'notempty',
  'whenempty', 'when_empty', 'ifset', 'if_set', 'whenset', 'listvar', 'countvar',
]);

/** Macros that WRITE a variable named by their first arg. */
const VAR_WRITERS = new Set([
  'setvar', 'addvar', 'incvar', 'decvar', 'pushvar', 'popvar', 'shiftvar',
  'state.set', 'state.unset', 'state.delete', 'delvar',
]);

/** Hidden/engine keys that lint should never flag. */
function isEngineKey(key: string): boolean {
  return key.startsWith('__');
}

function storageKey(rawKey: string): string {
  return resolveVariableTarget(rawKey, { characterId: 'lint', characterName: 'lint' }).key;
}

// -----------------------------------------------------------------------------
// Lint
// -----------------------------------------------------------------------------

export function lintMacros(input: LintInput): LintFinding[] {
  const findings: LintFinding[] = [];
  const promptIds = new Set(input.prompts.map(p => p.identifier.toLowerCase()));

  // Hook/event config contributes variable writes
  const config = parseMacroEngineConfig(input.macroEngineConfig);
  const written = new Set<string>();
  const writtenByDisabled = new Set<string>();
  if (config) {
    for (const hook of config.hooks) {
      const actions = Array.isArray(hook.action) ? hook.action : [hook.action];
      for (const a of actions) written.add(storageKey(a.key.replace(/\$[\w]+/g, 'x')));
    }
    for (const event of config.events) {
      const lines = Array.isArray(event.do) ? event.do : [event.do];
      for (const line of lines) {
        const m = /^(?:state\.)?\w+\s+(\S+)/.exec(line.trim());
        if (m) written.add(storageKey(m[1].replace(/\$[\w]+/g, 'x')));
      }
    }
  }

  // Pass 1: collect writes, template definitions, block/override order
  const templatesDefined = new Set<string>();
  const blockSeenAt = new Map<string, string>(); // block name -> promptId
  interface Read { key: string; promptId: string; macro: string }
  const reads: Read[] = [];

  const allScanned: Array<{ prompt: LintPromptInput; macros: ScannedMacro[] }> = [];

  for (const prompt of input.prompts) {
    const macros = scanMacros(prompt.content);
    allScanned.push({ prompt, macros });

    // Unbalanced block-if: count "if"-heads vs terminators in raw text
    const opens = (prompt.content.match(/\{\{\s*#?if\s+[^:}][^}]*\}\}/gi) || []).length;
    const closes = (prompt.content.match(/\{\{\s*(\/if|endif|\/#if)\s*\}\}/gi) || []).length;
    if (opens !== closes) {
      findings.push({
        severity: 'error',
        rule: 'unbalanced-if',
        promptId: prompt.identifier,
        message: `"${prompt.name ?? prompt.identifier}" has ${opens} {{if}} block${opens === 1 ? '' : 's'} but ${closes} {{/if}} — unbalanced blocks render as literal text`,
      });
    }

    for (const m of macros) {
      // in_reply asks write their into= target
      if (m.name.startsWith('pick_in_reply') || m.name === 'ask_in_reply') {
        const into = m.args.find(a => a.startsWith('into='));
        if (into) {
          const target = into.slice(5).trim();
          (prompt.enabled === false ? writtenByDisabled : written).add(storageKey(target));
        }
      }
      if (VAR_WRITERS.has(m.name) && m.args[0] && !m.args[0].includes('{{')) {
        (prompt.enabled === false ? writtenByDisabled : written).add(storageKey(m.args[0]));
      }
      if (m.name === 'template' || m.name === 'partial') {
        if (m.args[0]) templatesDefined.add(m.args[0].toLowerCase());
      }
      if (m.name === 'block' && m.args[0] && !m.args[0].includes('{{')) {
        if (!blockSeenAt.has(m.args[0].toLowerCase())) {
          blockSeenAt.set(m.args[0].toLowerCase(), prompt.identifier);
        }
      }
      if (VAR_READERS.has(m.name) && m.args[0] && !m.args[0].includes('{{') && !m.args[0].includes('$')) {
        // For getvar, a second arg means nested access of arg0 — still arg0
        reads.push({ key: m.args[0], promptId: prompt.identifier, macro: m.raw });
      }
    }
  }

  // Pass 2: per-macro checks
  for (const { prompt, macros } of allScanned) {
    for (const m of macros) {
      if (isStructural(m.name)) continue;

      // Unknown macro. Only names that LOOK like macro names are checked —
      // space-syntax forms ({{getvar x}}), prose in braces, and legacy
      // shorthands are normalized away before the real parser sees them.
      if (!getMacro(m.name) && /^[a-z_][\w.]*$/.test(m.name)) {
        // {{macro::name::body}} defines a user macro named `name`
        const definedHere = allScanned.some(s =>
          s.macros.some(d => d.name === 'macro' && d.args.length >= 2 && d.args[0]?.toLowerCase() === m.name));
        if (!definedHere) {
          const suggestion = suggestMacro(m.name);
          findings.push({
            severity: 'warning',
            rule: 'unknown-macro',
            promptId: prompt.identifier,
            macro: m.raw,
            message: suggestion
              ? `Unknown macro "${m.name}" — did you mean "${suggestion}"?`
              : `Unknown macro "${m.name}"`,
          });
        }
      }

      // Prompt references
      if ((m.name === 'enabled' || m.name === 'when_enabled' || m.name === 'include') && m.args[0] && !m.args[0].includes('{{')) {
        const ref = m.args[0].toLowerCase();
        const isPrefixMatch = [...promptIds].some(id => id.startsWith(ref));
        if (!promptIds.has(ref) && !(m.name !== 'include' && isPrefixMatch)) {
          findings.push({
            severity: 'warning',
            rule: 'unknown-prompt-ref',
            promptId: prompt.identifier,
            macro: m.raw,
            message: `{{${m.name}}} references "${m.args[0]}" but no prompt with that identifier exists`,
          });
        }
      }

      // use_template without a definition
      if ((m.name === 'use_template' || m.name === 'use') && m.args[0] && !templatesDefined.has(m.args[0].toLowerCase())) {
        findings.push({
          severity: 'error',
          rule: 'unknown-template',
          promptId: prompt.identifier,
          macro: m.raw,
          message: `{{use_template::${m.args[0]}}} has no matching {{template::${m.args[0]}::...}} definition`,
        });
      }

      // override after its block (registry order = prompt list order)
      if (m.name === 'override' && m.args[0]) {
        const blockPrompt = blockSeenAt.get(m.args[0].toLowerCase());
        if (blockPrompt !== undefined) {
          const blockIdx = input.prompts.findIndex(p => p.identifier === blockPrompt);
          const overrideIdx = input.prompts.findIndex(p => p.identifier === prompt.identifier);
          if (overrideIdx > blockIdx) {
            findings.push({
              severity: 'warning',
              rule: 'override-after-block',
              promptId: prompt.identifier,
              macro: m.raw,
              message: `{{override::${m.args[0]}}} appears after the {{block::${m.args[0]}}} it targets — overrides must evaluate first (move this prompt above "${blockPrompt}")`,
            });
          }
        }
      }
    }
  }

  // Cost flag: off-band $ macros each cost a separate model call per render
  const offbandCount = allScanned.reduce(
    (sum, { prompt }) =>
      prompt.enabled === false
        ? sum
        : sum + (prompt.content.match(/\{\{\s*(pick|pick_or_keep|pick_when|ask_model|walkdown)\$!?\s*::/gi)?.length ?? 0),
    0
  );
  if (offbandCount > 0) {
    findings.push({
      severity: 'info',
      rule: 'offband-cost',
      message: `This preset makes up to ${offbandCount} off-band $ call${offbandCount === 1 ? '' : 's'} per render — each is a separate model call billed like generation tokens (answers are cached per chat; pick_or_keep$/pick_when$ may skip)`,
    });
  }

  // Pass 3: dangling reads
  for (const read of reads) {
    const key = storageKey(read.key);
    if (isEngineKey(key)) continue;
    if (written.has(key)) continue;
    if (writtenByDisabled.has(key)) {
      findings.push({
        severity: 'warning',
        rule: 'write-disabled',
        promptId: read.promptId,
        macro: read.macro,
        message: `"${read.key}" is only set by a currently-DISABLED prompt — this read will be empty unless that toggle is on`,
      });
    } else {
      findings.push({
        severity: 'info',
        rule: 'dangling-read',
        promptId: read.promptId,
        macro: read.macro,
        message: `"${read.key}" is read here but nothing in the preset sets it (it may be set by another preset, a hook capture, or intentionally external)`,
      });
    }
  }

  return findings;
}
