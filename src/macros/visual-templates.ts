// ============================================================================
// VISUAL TEMPLATES (macro engine spec Part V.3 / XI.1)
//
// Display-only transforms: tags the model emits become styled HTML at
// render time. Manifest-driven and universal — templates ship inside the
// preset (raw_settings.visual_templates), no filesystem, no regex script
// with inlined CSS:
//
//   {
//     "id": "phone",
//     "trigger": "[PHONE from=\"$from\"]$content[/PHONE]",
//     "html": "<div class=\"hp-phone\"><div class=\"hp-phone-sender\">{{from}}</div><div>{{content}}</div></div>",
//     "css": ".hp-phone { border-radius: 12px; padding: 8px; }"
//   }
//
// Trigger grammar: a literal pattern; `$name` captures a value within the
// tag, `$content` captures everything between the opening and closing
// parts. Captures substitute into the HTML's {{name}} slots HTML-ESCAPED
// (model output never becomes markup). The produced HTML + <style> flows
// through the EXISTING chat-HTML safety pipeline (SafeHtmlContent →
// DOMPurify + CSS scoping to .safe-html-content), the same trust model as
// author regex scripts that emit HTML today.
//
// Applied client-side in the display pipeline (after display_only regex),
// never sent to the model and never persisted.
// ============================================================================

export interface VisualTemplate {
  id: string;
  /** Literal trigger with $name captures, $content for the body */
  trigger: string;
  /** HTML with {{name}} slots; {{content}} receives the body */
  html: string;
  css?: string;
}

interface CompiledTemplate {
  template: VisualTemplate;
  regex: RegExp;
}

// -----------------------------------------------------------------------------
// Manifest parsing
// -----------------------------------------------------------------------------

/**
 * Parse a preset's visual template manifest (raw_settings.visual_templates).
 * Invalid entries are skipped; never throws.
 */
export function parseVisualTemplates(raw: unknown): VisualTemplate[] {
  if (!Array.isArray(raw)) return [];
  const templates: VisualTemplate[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== 'string' || typeof e.trigger !== 'string' || typeof e.html !== 'string') continue;
    if (!e.id || !e.trigger || !e.html) continue;
    templates.push({
      id: e.id,
      trigger: e.trigger,
      html: e.html,
      css: typeof e.css === 'string' && e.css.trim() ? e.css : undefined,
    });
  }
  return templates;
}

// -----------------------------------------------------------------------------
// Trigger compilation
// -----------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compile one literal chunk: escape, tolerate whitespace runs. */
function compileLiteral(chunk: string): string {
  return escapeRegExp(chunk).replace(/\s+/g, '\\s+');
}

/**
 * Compile a trigger into a global regex. `$name` → named capture within a
 * line; `$content` → lazy multi-line capture (the tag body).
 */
export function compileTrigger(trigger: string): RegExp | null {
  try {
    const parts = trigger.split(/(\$[A-Za-z_][\w]*)/g);
    let source = '';
    for (const part of parts) {
      if (part === '$content') {
        source += '(?<content>[\\s\\S]*?)';
      } else if (/^\$[A-Za-z_][\w]*$/.test(part)) {
        source += `\\s*(?<${part.slice(1)}>[^\\[\\]\\n"]*?)\\s*`;
      } else if (part) {
        source += compileLiteral(part);
      }
    }
    return new RegExp(source, 'g');
  } catch {
    return null; // duplicate capture names, etc. — author error, skip
  }
}

// -----------------------------------------------------------------------------
// Application
// -----------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Substitute {{name}} slots with escaped capture values. */
function fillSlots(html: string, groups: Record<string, string | undefined>): string {
  return html.replace(/\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g, (token, name: string) => {
    const value = groups[name];
    if (value === undefined) return token;
    return escapeHtml(value.trim()).replace(/\n/g, '<br>');
  });
}

/** Compile a manifest once for repeated application. */
export function compileVisualTemplates(templates: VisualTemplate[]): CompiledTemplate[] {
  const compiled: CompiledTemplate[] = [];
  for (const template of templates) {
    const regex = compileTrigger(template.trigger);
    if (regex) compiled.push({ template, regex });
  }
  return compiled;
}

/**
 * Replace template triggers in display text with their rendered HTML.
 * Each matched template's CSS is emitted once (per text) in a <style>
 * block; downstream sanitization scopes it to the message container.
 */
export function applyVisualTemplates(
  text: string,
  templates: VisualTemplate[] | CompiledTemplate[]
): string {
  if (!text || templates.length === 0) return text;

  const compiled: CompiledTemplate[] =
    'regex' in (templates[0] as CompiledTemplate)
      ? (templates as CompiledTemplate[])
      : compileVisualTemplates(templates as VisualTemplate[]);

  let result = text;
  const usedCss: string[] = [];

  for (const { template, regex } of compiled) {
    let matched = false;
    regex.lastIndex = 0;
    result = result.replace(regex, (...args) => {
      const maybeGroups = args[args.length - 1];
      const groups = (typeof maybeGroups === 'object' && maybeGroups !== null
        ? maybeGroups
        : {}) as Record<string, string | undefined>;
      matched = true;
      return `<div class="visual-template vt-${escapeHtml(template.id)}">${fillSlots(template.html, groups)}</div>`;
    });
    if (matched && template.css) {
      usedCss.push(template.css);
    }
  }

  if (usedCss.length > 0) {
    result = `<style>\n${usedCss.join('\n')}\n</style>\n${result}`;
  }

  return result;
}
