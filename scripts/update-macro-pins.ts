/**
 * Regenerate hermetic macro-catalog source pins after an intentional upstream review. The resulting
 * fixtures are committed so CI never depends on private checkouts or a machine-local ST install.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  ROLECALL_MACRO_GROUPS,
  SILLYTAVERN_MACRO_GROUPS,
} from "../src/core/preset/macros";
import type { MacroGroup } from "../src/core/preset/macros/types";

const dir = join("src", "core", "preset", "macros", "_fixtures");
await mkdir(dir, { recursive: true });

const writePin = async (name: string, provenance: string, groups: MacroGroup[]): Promise<void> => {
  const pin = {
    provenance,
    capturedAt: "2026-07-20",
    groups: groups.map((group) => ({
      name: group.name,
      tokens: group.macros.map((macro) => macro.macro),
    })),
  };
  await Bun.write(join(dir, `${name}.json`), `${JSON.stringify(pin, null, 2)}\n`);
};

await writePin(
  "rolecall-source-pin",
  "Reviewed against RoleCall MacroReferenceDropdown source; private upstream represented by this committed snapshot.",
  ROLECALL_MACRO_GROUPS,
);
await writePin(
  "sillytavern-source-pin",
  "Reviewed against SillyTavern public/scripts/templates/macros.html; represented by this committed snapshot.",
  SILLYTAVERN_MACRO_GROUPS,
);
console.log("macro pins updated");
