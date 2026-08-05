/**
 * The Workbench's view of the generated capability seam.
 *
 * The seam itself moved to src/generated/capabilities.ts when Kit needed it too. It could not stay
 * here: a compiled Kit binary cannot walk a folder to find its capabilities, and Kit reaching into a
 * browser app's folder to borrow one would be the wrong direction for the sake of a filename. One
 * generator, one gate (`bun run capabilities:check`), two readers.
 *
 * Hand-written and no longer generated. Kept so the browser bundle's import path did not have to
 * change alongside everything else.
 */
export { allCapabilities as workbenchCapabilities } from "../../../../generated/capabilities";
