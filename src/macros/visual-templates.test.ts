// ============================================================================
// VISUAL TEMPLATES TESTS (macro engine spec Part V.3 / XI.1)
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  parseVisualTemplates,
  compileTrigger,
  applyVisualTemplates,
  type VisualTemplate,
} from './visual-templates';

const PHONE: VisualTemplate = {
  id: 'phone',
  trigger: '[PHONE from="$from"]$content[/PHONE]',
  html: '<div class="hp-phone-sender">{{from}}</div><div class="hp-phone-content">{{content}}</div>',
  css: '.hp-phone-sender { font-weight: bold; }',
};

describe('parseVisualTemplates', () => {
  it('parses valid manifests and skips junk', () => {
    const parsed = parseVisualTemplates([
      { id: 'phone', trigger: '[P]$content[/P]', html: '<div>{{content}}</div>', css: '.x{}' },
      { id: '', trigger: '[X]', html: '<div/>' },          // empty id
      { id: 'no-html', trigger: '[X]' },                   // missing html
      'garbage',
      null,
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('phone');
  });

  it('returns empty for non-arrays', () => {
    expect(parseVisualTemplates(undefined)).toEqual([]);
    expect(parseVisualTemplates({})).toEqual([]);
  });
});

describe('compileTrigger', () => {
  it('captures attributes and content', () => {
    const re = compileTrigger('[PHONE from="$from"]$content[/PHONE]')!;
    const m = re.exec('[PHONE from="Mara"]hey, you up?[/PHONE]');
    expect(m?.groups?.from).toBe('Mara');
    expect(m?.groups?.content).toBe('hey, you up?');
  });

  it('content captures span lines', () => {
    const re = compileTrigger('[LETTER]$content[/LETTER]')!;
    const m = re.exec('[LETTER]Dear V,\nThe stage is dark.\n— S[/LETTER]');
    expect(m?.groups?.content).toContain('The stage is dark.');
  });
});

describe('applyVisualTemplates', () => {
  it('replaces the trigger with rendered HTML and prepends CSS once', () => {
    const out = applyVisualTemplates(
      'before [PHONE from="Mara"]hey[/PHONE] after',
      [PHONE]
    );
    expect(out).toContain('<div class="hp-phone-sender">Mara</div>');
    expect(out).toContain('<div class="hp-phone-content">hey</div>');
    expect(out).toContain('class="visual-template vt-phone"');
    expect(out.indexOf('<style>')).toBe(0);
    expect(out.match(/hp-phone-sender \{/g)).toHaveLength(1);
    expect(out).toContain('before ');
    expect(out).toContain(' after');
  });

  it('handles multiple occurrences, CSS still emitted once', () => {
    const out = applyVisualTemplates(
      '[PHONE from="A"]one[/PHONE]\n[PHONE from="B"]two[/PHONE]',
      [PHONE]
    );
    expect(out.match(/vt-phone/g)).toHaveLength(2);
    expect(out.match(/<style>/g)).toHaveLength(1);
  });

  it('HTML-escapes captured values — model output never becomes markup', () => {
    const out = applyVisualTemplates(
      '[PHONE from="<script>alert(1)</script>"]<img src=x onerror=y>[/PHONE]',
      [PHONE]
    );
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&lt;img');
  });

  it('converts newlines in content to <br>', () => {
    const out = applyVisualTemplates('[PHONE from="A"]line1\nline2[/PHONE]', [PHONE]);
    expect(out).toContain('line1<br>line2');
  });

  it('text without triggers passes through untouched', () => {
    const text = 'Just a normal reply with [brackets] and no templates.';
    expect(applyVisualTemplates(text, [PHONE])).toBe(text);
  });

  it('no templates → identity', () => {
    expect(applyVisualTemplates('anything', [])).toBe('anything');
  });

  it('unknown {{slots}} stay literal, missing css is fine', () => {
    const out = applyVisualTemplates('[B]x[/B]', [
      { id: 'b', trigger: '[B]$content[/B]', html: '<b>{{content}}{{nope}}</b>' },
    ]);
    expect(out).toContain('<b>x{{nope}}</b>');
    expect(out).not.toContain('<style>');
  });
});
