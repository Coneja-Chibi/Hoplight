/**
 * Pure character-body path operations shared by semantic capabilities and the Workbench editor.
 */

import { readEntityPath, writeEntityPath } from "../../_shared/path-operations";

const isEmpty = (value: unknown): boolean =>
  value === undefined
  || value === ""
  || (Array.isArray(value) && value.length === 0);

/** Read an authored value at one canonical character dot path. */
export function readCharacterPath(body: unknown, dotPath: string): unknown {
  return readEntityPath(body, dotPath);
}

/** Immutably write or remove one canonical character path without touching sibling branches. */
export function writeCharacterPath(
  body: Record<string, unknown>,
  dotPath: string,
  value: unknown,
): Record<string, unknown> {
  return writeEntityPath(body, dotPath, value, isEmpty);
}

/** Apply an explicit semantic field map in caller-provided order. */
export function patchCharacterPaths(
  body: Record<string, unknown>,
  patch: Readonly<Record<string, unknown>>,
  paths: Readonly<Record<string, string>>,
): Record<string, unknown> {
  let output = body;
  for (const [field, value] of Object.entries(patch)) {
    const path = paths[field];
    if (path) output = writeCharacterPath(output, path, value === null ? undefined : value);
  }
  return output;
}
