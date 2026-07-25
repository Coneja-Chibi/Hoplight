/**
 * Immutable JSON dot-path operations shared by canonical entity mutation authorities.
 */

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

/** Read one value from a JSON object by canonical dot path. */
export function readEntityPath(value: unknown, dotPath: string): unknown {
  let current: unknown = value;
  for (const key of dotPath.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Immutably write one JSON dot path, using the caller's domain-specific removal rule. */
export function writeEntityPath(
  value: Record<string, unknown>,
  dotPath: string,
  nextValue: unknown,
  remove: (candidate: unknown) => boolean,
): Record<string, unknown> {
  const keys = dotPath.split(".");
  const output: Record<string, unknown> = { ...value };
  let host = output;
  for (const key of keys.slice(0, -1)) {
    const next = { ...record(host[key]) };
    host[key] = next;
    host = next;
  }
  const leaf = keys.at(-1)!;
  if (remove(nextValue)) delete host[leaf];
  else host[leaf] = structuredClone(nextValue);
  return output;
}
