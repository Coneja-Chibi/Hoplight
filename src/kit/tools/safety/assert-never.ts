/**
 * The exhaustiveness sentinel for the safety cluster's closed-union switches. A kit-local copy rather
 * than a reach into src/core/regex/ast: the trust boundary must not take a dependency on an unrelated
 * subsystem, and this folder can only add files to itself. When the cluster is wired live, promote this
 * to one kit-wide shared helper and delete the copy. Callers pass their scope so the thrown message
 * keeps naming the switch that missed a variant.
 */
export function assertNever(scope: string, value: never): never {
  throw new Error(`${scope}: unhandled variant ${JSON.stringify(value)}`);
}
