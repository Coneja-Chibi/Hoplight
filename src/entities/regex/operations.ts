/** Pure standalone regex-set operations shared by Kit and the Workbench editor. */
import type { RegexRule, RegexSetBody } from "./schema";

const requireRule = (body: RegexSetBody, id: string): RegexRule => {
  const rule = body.rules.find((item) => item.id === id);
  if (!rule) throw new Error(`regex rule "${id}" does not exist`);
  return rule;
};

export function addRegexRule(
  body: RegexSetBody,
  rule: RegexRule,
  at = body.rules.length,
): RegexSetBody {
  if (body.rules.some((item) => item.id === rule.id)) {
    throw new Error(`regex rule "${rule.id}" already exists`);
  }
  if (at < 0 || at > body.rules.length) throw new Error(`regex insertion ${at} is out of range`);
  return {
    ...body,
    rules: [...body.rules.slice(0, at), structuredClone(rule), ...body.rules.slice(at)],
  };
}

export function patchRegexRule(
  body: RegexSetBody,
  id: string,
  patch: Partial<RegexRule>,
): RegexSetBody {
  requireRule(body, id);
  return {
    ...body,
    rules: body.rules.map((item) =>
      item.id === id ? { ...item, ...structuredClone(patch), id: item.id } : item),
  };
}

export function removeRegexRule(body: RegexSetBody, id: string): RegexSetBody {
  requireRule(body, id);
  return { ...body, rules: body.rules.filter((item) => item.id !== id) };
}

export function moveRegexRule(body: RegexSetBody, id: string, to: number): RegexSetBody {
  const from = body.rules.findIndex((item) => item.id === id);
  if (from < 0) throw new Error(`regex rule "${id}" does not exist`);
  const rules = [...body.rules];
  const [moved] = rules.splice(from, 1);
  rules.splice(Math.max(0, Math.min(to, rules.length)), 0, moved!);
  return { ...body, rules };
}

export function patchRegexSet(
  body: RegexSetBody,
  patch: Partial<Pick<RegexSetBody, "name" | "description" | "enabled">>,
): RegexSetBody {
  return { ...body, ...structuredClone(patch) };
}
