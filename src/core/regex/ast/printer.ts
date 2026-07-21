/**
 * The regex AST printer (REGEX-JEWEL-PLAN.md Phase R2X keystone). Reconstructs an equivalent
 * pattern string from an ast-types.ts tree. Split from parser.ts to keep each file to one concept
 * under the 500-line cap; parser.ts re-exports printRegex so the keystone's public API stays whole.
 *
 * Structure is rebuilt canonically; leaf text (literals, class/property escapes, backreferences) is
 * emitted from each node's source form so escaping and capture numbering round-trip. This is NOT a
 * string echo: printRegex(parseRegex(p)) is a stable fixpoint and compiles to a matcher equivalent
 * to the original pattern.
 */
import { assertNever } from "./assert-never";
import type {
  Alternation,
  Anchor,
  CharClass,
  Group,
  Lookaround,
  Node,
  Sequence,
  UnicodeProperty,
} from "./ast-types";

const ANCHOR_TEXT: Record<Anchor["kind"], string> = {
  "line-start": "^",
  "line-end": "$",
  "word-boundary": "\\b",
  "non-word-boundary": "\\B",
};

/** Reconstruct an equivalent pattern string from an AST root. */
export function printRegex(ast: Alternation): string {
  return printAlternation(ast);
}

function printAlternation(node: Alternation): string {
  return node.alternatives.map(printSequence).join("|");
}

function printSequence(node: Sequence): string {
  return node.elements.map(printNode).join("");
}

function printNode(node: Node): string {
  switch (node.type) {
    case "alternation":
      return printAlternation(node);
    case "sequence":
      return printSequence(node);
    case "literal":
      return node.raw;
    case "dot":
      return ".";
    case "anchor":
      return ANCHOR_TEXT[node.kind];
    case "class-escape":
      return `\\${node.letter}`;
    case "unicode-property":
      return printProperty(node);
    case "char-class":
      return printClass(node);
    case "quantifier":
      return printNode(node.body) + printQuantifierSuffix(node.min, node.max) + (node.lazy ? "?" : "");
    case "group":
      return printGroup(node);
    case "lookaround":
      return printLookaround(node);
    case "backreference":
      return node.raw;
    default:
      return assertNever("regex/print", node);
  }
}

function printProperty(node: UnicodeProperty): string {
  const head = node.negated ? "\\P{" : "\\p{";
  return `${head}${node.name}${node.value === undefined ? "" : `=${node.value}`}}`;
}

function printClass(node: CharClass): string {
  const body = node.items
    .map((item) => {
      if (item.type === "class-range") return `${item.from.raw}-${item.to.raw}`;
      if (item.type === "literal") return item.raw;
      if (item.type === "class-escape") return `\\${item.letter}`;
      return printProperty(item);
    })
    .join("");
  return `[${node.negated ? "^" : ""}${body}]`;
}

function printQuantifierSuffix(min: number, max: number | null): string {
  if (min === 0 && max === null) return "*";
  if (min === 1 && max === null) return "+";
  if (min === 0 && max === 1) return "?";
  if (max === null) return `{${min},}`;
  if (max === min) return `{${min}}`;
  return `{${min},${max}}`;
}

function printGroup(node: Group): string {
  const body = printAlternation(node.body);
  if (node.modifiers) {
    const { add, remove } = node.modifiers;
    return `(?${add}${remove ? `-${remove}` : ""}:${body})`;
  }
  if (node.name !== null) return `(?<${node.name}>${body})`;
  if (!node.capturing) return `(?:${body})`;
  return `(${body})`;
}

function printLookaround(node: Lookaround): string {
  const head = node.ahead ? (node.negative ? "(?!" : "(?=") : node.negative ? "(?<!" : "(?<=";
  return `${head}${printAlternation(node.body)})`;
}

