/**
 * A tiny, dependency-free tokenizer for the code editor. Returns TYPED tokens (never HTML) so the editor
 * renders them as React text nodes - the card's source is untrusted, and React escapes text content, so
 * there is no innerHTML and no XSS surface. It highlights the one thing that matters across every Risu
 * language - CBS {{macros}} - plus strings, comments, numbers, and per-language keywords. It is a
 * best-effort highlighter, not a parser: on anything it does not recognize it falls back to plain text.
 */
export type TokenType = "plain" | "macro" | "string" | "comment" | "keyword" | "number";

export interface Token {
  type: TokenType;
  text: string;
}

export type CodeLang = "html" | "css" | "js" | "lua" | "vars" | "text";

interface LangRules {
  line?: string; // line-comment opener
  block?: [string, string]; // block-comment [open, close]
  strings: readonly string[]; // string delimiters
  keywords: ReadonlySet<string>;
}

const kw = (...w: string[]): ReadonlySet<string> => new Set(w);

const LANGS: Record<CodeLang, LangRules> = {
  js: { line: "//", block: ["/*", "*/"], strings: ['"', "'", "`"], keywords: kw("const", "let", "var", "function", "return", "if", "else", "for", "while", "of", "in", "new", "true", "false", "null", "undefined", "async", "await", "try", "catch", "class") },
  lua: { line: "--", block: ["--[[", "]]"], strings: ['"', "'"], keywords: kw("local", "function", "end", "if", "then", "else", "elseif", "return", "for", "while", "do", "repeat", "until", "and", "or", "not", "true", "false", "nil", "in") },
  css: { block: ["/*", "*/"], strings: ['"', "'"], keywords: kw() },
  html: { block: ["<!--", "-->"], strings: ['"', "'"], keywords: kw() },
  vars: { line: "#", strings: [], keywords: kw() },
  text: { strings: [], keywords: kw() },
};

const isWordChar = (c: string): boolean => /[A-Za-z0-9_$]/.test(c);
const isDigit = (c: string): boolean => c >= "0" && c <= "9";

/** Tokenize source for highlighting. Never throws; unrecognized input becomes plain tokens. */
export function tokenize(code: string, lang: CodeLang = "text"): Token[] {
  const rules = LANGS[lang] ?? LANGS.text;
  const out: Token[] = [];
  let plain = "";
  const flush = (): void => {
    if (plain !== "") out.push({ type: "plain", text: plain });
    plain = "";
  };
  const push = (type: TokenType, text: string): void => {
    flush();
    out.push({ type, text });
  };

  let i = 0;
  const n = code.length;
  while (i < n) {
    const rest = code.slice(i);

    // CBS macro {{ ... }} (may nest; take up to the matching-ish close, non-greedy to first }})
    if (rest.startsWith("{{")) {
      const end = code.indexOf("}}", i + 2);
      const stop = end === -1 ? n : end + 2;
      push("macro", code.slice(i, stop));
      i = stop;
      continue;
    }

    // block comment
    if (rules.block && rest.startsWith(rules.block[0])) {
      const end = code.indexOf(rules.block[1], i + rules.block[0].length);
      const stop = end === -1 ? n : end + rules.block[1].length;
      push("comment", code.slice(i, stop));
      i = stop;
      continue;
    }

    // line comment
    if (rules.line && rest.startsWith(rules.line)) {
      const nl = code.indexOf("\n", i);
      const stop = nl === -1 ? n : nl;
      push("comment", code.slice(i, stop));
      i = stop;
      continue;
    }

    // string literal
    const ch = code[i]!;
    if (rules.strings.includes(ch)) {
      let j = i + 1;
      while (j < n && code[j] !== ch) {
        if (code[j] === "\\") j += 1; // skip escaped char
        j += 1;
      }
      const stop = Math.min(j + 1, n);
      push("string", code.slice(i, stop));
      i = stop;
      continue;
    }

    // number
    if (isDigit(ch)) {
      let j = i;
      while (j < n && /[0-9.]/.test(code[j]!)) j += 1;
      push("number", code.slice(i, j));
      i = j;
      continue;
    }

    // word (keyword or plain)
    if (isWordChar(ch)) {
      let j = i;
      while (j < n && isWordChar(code[j]!)) j += 1;
      const word = code.slice(i, j);
      if (rules.keywords.has(word)) push("keyword", word);
      else plain += word;
      i = j;
      continue;
    }

    plain += ch;
    i += 1;
  }
  flush();
  return out;
}
