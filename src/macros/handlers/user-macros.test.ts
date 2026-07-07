// ============================================================================
// USER-DEFINED MACROS TESTS
// Tests for define/call macro functions with positional arguments
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { processMacros, createDefaultContext } from '../processor';
import { initializeMacros } from '../index';
import { MacroContext } from '../types';

beforeAll(() => {
  initializeMacros();
});

function createTestContext(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: 'Alice',
    userName: 'Bob',
    messages: [],
    messageCount: 0,
    ...overrides,
  });
}

describe('user-defined macros', () => {
  describe('define and call', () => {
    it('defines a macro and calls it with no args', () => {
      const ctx = createTestContext();
      const text = '{{macro::greet::Hello world!}}Result: {{macro::greet}}';
      const result = processMacros(text, ctx);
      expect(result.text).toBe('Result: Hello world!');
    });

    it('defines a macro with positional args and calls it', () => {
      const ctx = createTestContext();
      const text = '{{macro::greet::Hello {{$1}}, welcome to {{$2}}!}}{{macro::greet::Bob::Narnia}}';
      const result = processMacros(text, ctx);
      expect(result.text).toBe('Hello Bob, welcome to Narnia!');
    });

    it('resolves built-in macros in body at define time', () => {
      const ctx = createTestContext();
      const text = '{{macro::intro::I am {{char}}.}}{{macro::intro}}';
      const result = processMacros(text, ctx);
      expect(result.text).toBe('I am Alice.');
    });

    it('supports multiple positional args', () => {
      const ctx = createTestContext();
      const text = '{{macro::fmt::{{$1}} + {{$2}} = {{$3}}}}{{macro::fmt::1::2::3}}';
      const result = processMacros(text, ctx);
      expect(result.text).toBe('1 + 2 = 3');
    });
  });

  describe('error handling', () => {
    it('returns error for undefined macro with no body', () => {
      const ctx = createTestContext();
      const text = '{{macro::nonexistent}}';
      const result = processMacros(text, ctx);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Undefined macro: nonexistent');
    });

    it('returns error when no name is provided', () => {
      const ctx = createTestContext();
      const text = '{{macro}}';
      const result = processMacros(text, ctx);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Macro name required');
    });
  });

  describe('unreplaced placeholders', () => {
    it('strips unreplaced positional placeholders', () => {
      const ctx = createTestContext();
      const text = '{{macro::tmpl::A={{$1}} B={{$2}} C={{$3}}}}{{macro::tmpl::X}}';
      const result = processMacros(text, ctx);
      expect(result.text).toBe('A=X B= C=');
    });
  });

  describe('multiple macros', () => {
    it('supports defining multiple macros independently', () => {
      const ctx = createTestContext();
      const text = [
        '{{macro::hello::Hi {{$1}}!}}',
        '{{macro::bye::Goodbye {{$1}}!}}',
        '{{macro::hello::World}} {{macro::bye::World}}',
      ].join('');
      const result = processMacros(text, ctx);
      expect(result.text).toBe('Hi World! Goodbye World!');
    });

    it('calls the same macro multiple times with different args', () => {
      const ctx = createTestContext();
      const text = '{{macro::wrap::[{{$1}}]}}{{macro::wrap::a}} {{macro::wrap::b}} {{macro::wrap::c}}';
      const result = processMacros(text, ctx);
      expect(result.text).toBe('[a] [b] [c]');
    });
  });

  describe('case insensitivity', () => {
    it('treats macro names as case-insensitive', () => {
      const ctx = createTestContext();
      const text = '{{macro::MyMacro::hello}}{{macro::mymacro}}';
      const result = processMacros(text, ctx);
      expect(result.text).toBe('hello');
    });
  });

  describe('redefinition behavior', () => {
    it('treats second define as a call (first arg becomes $1)', () => {
      const ctx = createTestContext();
      // Define "test" with body "value={{$1}}"
      // Then "call" with what looks like a new body — but since "test" exists, it's a call
      const text = '{{macro::test::value={{$1}}}}{{macro::test::42}}';
      const result = processMacros(text, ctx);
      expect(result.text).toBe('value=42');
    });
  });

  describe('interaction with macro system', () => {
    it('re-parses macro output containing built-in macros', () => {
      const ctx = createTestContext();
      // Define a macro whose output contains a built-in macro reference
      // The body will be stored with {{$1}} as-is (not a registered macro, so preserved)
      // When called, {{$1}} is replaced, and if the result contains {{char}}, it gets re-parsed
      const text = '{{macro::dynamic::My name is {{$1}}}}{{macro::dynamic::{{char}}}}';
      const result = processMacros(text, ctx);
      // {{char}} in arg is evaluated first → "Alice", then substituted into body
      expect(result.text).toBe('My name is Alice');
    });

    it('empty definition produces no output', () => {
      const ctx = createTestContext();
      const text = 'before{{macro::x::body}}after';
      const result = processMacros(text, ctx);
      expect(result.text).toBe('beforeafter');
    });
  });
});
