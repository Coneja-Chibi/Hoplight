/**
 * The one exhaustiveness sentinel for the regex AST walkers, extracted from four identical
 * per-file copies (examples/explain/printer/redos). Callers pass their scope so the thrown
 * message keeps naming the walker that missed a variant.
 */
export function assertNever(scope: string, value: never): never {
  throw new Error(`${scope}: unhandled variant ${JSON.stringify(value)}`);
}
