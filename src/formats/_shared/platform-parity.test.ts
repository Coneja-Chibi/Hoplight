/**
 * Registry parity for derived platforms: a platform riding EXTENSION_PLATFORMS gets only the
 * merged character lens for free, and everything else is a hand-maintained list. This suite makes
 * silent absence impossible: every extension platform is either present in each capability
 * registry or explicitly excluded here with a reason. (Marinara drifted out of several lists this
 * way before this gate existed.)
 */
import { describe, expect, test } from "bun:test";
import { EXTENSION_PLATFORMS } from "./extension-platforms";
import { LORE_WRITE_FOR_PROFILES } from "../../core/lore/capabilities";
import { PERSONA_WRITE_FOR_PROFILES } from "../../core/persona/capabilities";
import { REGEX_WRITE_FOR_PROFILES } from "../../core/regex/capabilities";
import { PRESET_WRITE_FOR_PROFILES } from "../../core/preset/capabilities";
import { labelCard } from "../../entities/character/provenance";

/** Absence is allowed ONLY with a stated reason. Adding a row here is a design decision. */
const EXCLUSIONS: Record<string, Record<string, string>> = {
  chub: {
    persona: "Chub has no persona wire; personas are not part of its card ecosystem",
    regex: "Chub has no regex script format",
    preset: "Chub has no preset format",
  },
  marinara: {
    // (none: Marinara participates in every registry below)
  },
  "default-ccv3": {
    lore: "Default is the portable-CCv3 character tab, not a platform; the CCv3 lore floor is served by the chub/lumiverse/marinara lenses",
    persona: "not a platform; no persona ecosystem to write for",
    regex: "not a platform; no regex format",
    preset: "not a platform; no preset format",
  },
};

const REGISTRIES: Record<string, readonly string[]> = {
  lore: LORE_WRITE_FOR_PROFILES,
  persona: PERSONA_WRITE_FOR_PROFILES,
  regex: REGEX_WRITE_FOR_PROFILES,
  preset: PRESET_WRITE_FOR_PROFILES,
};

describe("extension-platform registry parity", () => {
  for (const platform of EXTENSION_PLATFORMS) {
    for (const [registry, members] of Object.entries(REGISTRIES)) {
      test(`${platform.id} is in the ${registry} registry or explicitly excluded`, () => {
        const present = (members as readonly string[]).includes(platform.id);
        const excluded = typeof EXCLUSIONS[platform.id]?.[registry] === "string";
        expect(present || excluded).toBe(true);
        expect(present && excluded).toBe(false); // stale exclusion rows must be removed
      });
    }
  }
});

describe("extension-platform provenance fingerprints", () => {
  const stCard = (extensions: Record<string, unknown>) => ({
    spec: "chara_card_v3",
    data: { name: "P", description: "", extensions },
  });

  test("a Marinara card is attributed to Marinara Engine, not SillyTavern", () => {
    const p = labelCard(stCard({ rpgStats: { enabled: true, attributes: [] } }));
    expect(p.likelyOrigin).toBe("Marinara Engine");
    const colors = labelCard(stCard({ nameColor: "#ff6b6b" }));
    expect(colors.likelyOrigin).toBe("Marinara Engine");
  });

  test("a Chub card still wins on its namespace", () => {
    const p = labelCard(stCard({ chub: { id: 1 }, nameColor: "#fff" }));
    expect(p.likelyOrigin).toBe("Chub (CharacterHub)");
  });
});
