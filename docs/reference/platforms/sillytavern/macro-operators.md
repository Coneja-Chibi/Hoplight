---
id: reference/platforms/sillytavern/macro-operators
title: SillyTavern macro syntax and operators
audience: user
summary: Complete operational guide to SillyTavern macro parsing, argument forms, nesting, scoped content, conditionals, flags, comments, escaping, variable identifiers, shorthand operators, return values, and legacy markers.
tags: [platform, sillytavern, macros, syntax, operators, variables]
related: [reference/platforms/sillytavern/macros, reference/platforms/sillytavern/macro-reference, reference/platforms/sillytavern/source-coverage]
---

# SillyTavern macro syntax and operators

This page specifies how the pinned experimental SillyTavern macro engine interprets expressions. It
complements the complete name list in [Documented macro catalog](macro-reference.md).

Primary source: [Macros](https://docs.sillytavern.app/usage/core-concepts/macros/), pinned through
`SillyTavern/SillyTavern-Docs` commit `70e5e4d3c239253fca4692fe82e3936cb9c4b1b1`.

## Tokens, arguments, whitespace, and nesting

A macro uses `{{name}}`; names are case-insensitive. One argument may follow a space:

```text
{{getvar mood}}
```

Multiple arguments use `::`:

```text
{{setvar::mood::hopeful}}
{{random::red::green::blue}}
```

A single colon can introduce an argument for backward compatibility, but it is legacy syntax and should
not be authored for new content. Whitespace around a name, separators, and arguments is ignored.

Macros can nest. Inner expressions resolve before the outer consumer:

```text
{{getvar::{{char}}_mood}}
```

This resolves the current character name before looking up the resulting variable key. Nested evaluation
also means state mutation and random output can affect an enclosing expression.

## Scoped blocks and whitespace preservation

Any macro accepting an argument can receive its final argument from a block:

```text
{{setvar backstory}}
  Multiline authored content.
{{/setvar}}
```

The closing form uses `/`. By default SillyTavern removes leading and trailing whitespace and dedents all
lines by the indentation of the first non-empty line. `#` on the opening macro preserves every character,
including surrounding newlines and indentation:

```text
{{#setvar code}}
    literal indentation
{{/setvar}}
```

Scoped syntax is equivalent to supplying the block body as the final inline argument after other
arguments. It is useful when content contains newlines or would be unreadable inside separators.

## Conditions, inversion, and else

`{{if condition}}...{{/if}}` emits its body when the condition is truthy. A condition may be a no-argument
macro name, a nested expression, a local or global variable shorthand, or literal text. SillyTavern treats
empty text, `false`, `0`, `off`, and `no` as false.

Prefixing the tested value with `!` inverts it:

```text
{{if !personality}}No personality is defined.{{/if}}
```

`{{else}}` introduces the alternative branch:

```text
{{if .enabled}}Enabled{{else}}Disabled{{/if}}
```

The inversion character in an `if` condition is not the planned immediate macro flag. Context determines
which meaning applies.

## Flags, comments, and escaping

Only two macro flags are implemented in the pinned documentation:

| Flag | Meaning |
| --- | --- |
| `/` | Closes a scoped block |
| `#` | Preserves all whitespace in scoped content |

The official page describes `!` immediate, `?` delayed, `~` re-evaluate, and `>` filter as planned but not
implemented. They must not appear in generated instructions as working features.

Single-line comments use `{{// comment}}`. A scoped comment begins with `{{//}}` and closes with `{{///}}`;
its body produces no output. To display braces literally, escape them with backslashes:

```text
\{\{literal\}\}
```

## Variable scopes and identifier rules

`.` selects a chat-local variable and `$` selects an installation-global variable. These are shorthand
prefixes, not macro flags. A shorthand identifier begins with a letter, continues with letters, digits,
underscores, or hyphens, and cannot end in an underscore or hyphen. Nonconforming names require full
`getvar`, `setvar`, or global macro syntax.

Nested macros are allowed in assigned values. Whitespace around shorthand operators is ignored. The local
and global forms support the same operators and differ only in storage scope.

## Variable shorthand operator table

| Operator | Operation | Return behavior | Qualification |
| --- | --- | --- | --- |
| none | Get | Current value | Undefined produces no stored value |
| `=` | Set | Empty text | Stores the supplied value |
| `++` | Increment | New value | Numeric addition by one |
| `--` | Decrement | New value | Numeric subtraction by one |
| `+=` | Add or append | Empty text | Numeric addition, or string concatenation when both operands are non-numeric |
| `-=` | Subtract | Empty text | Numeric only; invalid input logs a warning and leaves state unchanged |
| `||` | Falsy fallback | Existing truthy value or lazily evaluated fallback | Empty, zero, and false use the fallback |
| `??` | Undefined fallback | Existing value or lazily evaluated fallback | Preserves defined falsy values |
| `||=` | Assign on falsy | Final existing or assigned value | Mutates when current value is falsy |
| `??=` | Assign on undefined | Final existing or assigned value | Mutates only when no value exists |
| `==` | String equality | Literal `"true"` or `"false"` | Missing, null, and empty compare as the same |
| `!=` | String inequality | Literal `"true"` or `"false"` | Missing, null, and empty compare as the same |
| `>` | Numeric greater-than | Literal `"true"` or `"false"` | Numeric comparison |
| `>=` | Numeric greater-than-or-equal | Literal `"true"` or `"false"` | Numeric comparison |
| `<` | Numeric less-than | Literal `"true"` or `"false"` | Numeric comparison |
| `<=` | Numeric less-than-or-equal | Literal `"true"` or `"false"` | Numeric comparison |

Examples:

```text
{{.mood}}
{{.mood = hopeful}}
{{.score += 10}}
{{.name ?? Guest}}
{{$feature ||= enabled}}
{{if {{.score >= 50}}}}Qualified{{/if}}
```

Fallback expressions are lazy: the right operand is evaluated only when needed. This matters when a
fallback contains random output or a state-changing nested macro.

## Full variable macros and shorthand equivalence

| Shorthand | Full local form | Full global form |
| --- | --- | --- |
| `{{.name}}` or `{{$name}}` | `{{getvar::name}}` | `{{getglobalvar::name}}` |
| `{{.name = value}}` or `{{$name = value}}` | `{{setvar::name::value}}` | `{{setglobalvar::name::value}}` |
| `{{.name += value}}` or `{{$name += value}}` | `{{addvar::name::value}}` | `{{addglobalvar::name::value}}` |
| `{{.name++}}` or `{{$name++}}` | `{{incvar::name}}` | `{{incglobalvar::name}}` |
| `{{.name--}}` or `{{$name--}}` | `{{decvar::name}}` | `{{decglobalvar::name}}` |

Existence and deletion use the full `hasvar`, `deletevar`, `hasglobalvar`, and `deleteglobalvar` forms.
Shorthand comparisons and conditional assignments do not have a one-token full-macro equivalent.

## Legacy markers

SillyTavern still recognizes these markers during processing:

| Legacy marker | Modern equivalent |
| --- | --- |
| `<USER>` | `{{user}}` |
| `<BOT>` | `{{char}}` |
| `<CHAR>` | `{{char}}` |
| `<GROUP>` | `{{group}}` |
| `<CHARIFNOTGROUP>` | `{{charIfNotGroup}}` |

New content should use modern braces. Hoplight preserves legacy text during same-format round trips rather
than rewriting it merely for style.

## Evaluation and safety contract

Parsing does not imply universal field support. The current field and processing stage decide which names
are registered and when nested expressions run. Variable assignment, deletion, random selection, banned
word changes, and extension-provided macros can have effects beyond producing text.

Hoplight treats macro payloads as sealed source data during import, inspection, conversion, and export.
It never evaluates a macro to discover what it means. Cross-format conversion preserves supported literal
text, reports dialect behavior that cannot be represented, and avoids name-only substitutions between
incompatible languages.
