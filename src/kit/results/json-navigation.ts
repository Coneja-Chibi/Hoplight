/**
 * Fail-closed JSON Pointer traversal and shallow structural outlines for canonical observations.
 */

export const JSON_POINTER_PATTERN = /^(?:\/(?:[^~]|~[01])*)*$/;

export interface JsonOutlineEntry {
  path: string;
  type: "array" | "boolean" | "null" | "number" | "object" | "string";
  size?: number;
}

export interface JsonPointerResult {
  found: boolean;
  value?: unknown;
}

const typeOf = (value: unknown): JsonOutlineEntry["type"] => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as JsonOutlineEntry["type"];
};

const pointerSegment = (value: string): string =>
  value.replaceAll("~", "~0").replaceAll("/", "~1");

const decodeSegment = (value: string): string =>
  value.replaceAll("~1", "/").replaceAll("~0", "~");

/** Resolve one RFC 6901 JSON Pointer without prototype traversal or path guessing. */
export function resolveJsonPointer(root: unknown, pointer: string): JsonPointerResult {
  if (!JSON_POINTER_PATTERN.test(pointer)) return { found: false };
  if (pointer === "") return { found: true, value: root };
  let value = root;
  for (const raw of pointer.slice(1).split("/")) {
    const segment = decodeSegment(raw);
    if (Array.isArray(value)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) return { found: false };
      const index = Number(segment);
      if (index >= value.length) return { found: false };
      value = value[index];
      continue;
    }
    if (typeof value !== "object" || value === null || !Object.hasOwn(value, segment)) {
      return { found: false };
    }
    value = (value as Record<string, unknown>)[segment];
  }
  return { found: true, value };
}

/** Describe one value and its immediate children so a model can choose a narrower path. */
export function outlineJson(value: unknown, pointer: string): JsonOutlineEntry[] {
  const own = (path: string, item: unknown): JsonOutlineEntry => {
    const type = typeOf(item);
    const size = typeof item === "string"
      ? item.length
      : Array.isArray(item)
        ? item.length
        : type === "object"
          ? Object.keys(item as object).length
          : undefined;
    return { path, type, ...(size === undefined ? {} : { size }) };
  };
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      own(`${pointer}/${index}`, item));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).map(([key, item]) =>
      own(`${pointer}/${pointerSegment(key)}`, item));
  }
  return [own(pointer, value)];
}

/** Stable readable text for one selected canonical value. */
export const stringifyJsonValue = (value: unknown): string =>
  typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "undefined";
