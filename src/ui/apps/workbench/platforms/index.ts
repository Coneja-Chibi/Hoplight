/**
 * Native-schema registry - gathers every platform's own schema file into one lookup. Each platform is
 * its own sibling file (folders-as-schema), never a shared godfile, so you can lay them side by side
 * and audit where they align. To add a platform: drop `<platform>.ts` next to these and add one line
 * here. Grown one VERIFIED platform at a time (structure checked against the real stored shape, never
 * guessed - a wrong path silently edits nothing).
 */
import type { NativeSchema } from "../../../components/native-card";
import sillytavern from "./sillytavern";
import rolecall from "./rolecall";
import marinara from "./marinara";

/** every declared platform schema, in lens/build order */
export const NATIVE_SCHEMAS: readonly NativeSchema[] = [sillytavern, rolecall, marinara];

/** the native schema for an original key, or undefined when that platform has none declared yet */
export const nativeSchemaFor = (key: string): NativeSchema | undefined =>
  NATIVE_SCHEMAS.find((s) => s.key === key);
