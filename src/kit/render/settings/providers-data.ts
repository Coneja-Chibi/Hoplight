/**
 * Bridge from the drop-in spokes to the picker's choices. Reads the registry once and maps each
 * provider to what the setup screen needs (label, brand, default model, whether it is keyless or
 * needs a base URL). Custom sorts last: it is the escape hatch for any proxy or OpenAI-compatible
 * endpoint. Adding a provider file to spokes/ makes it appear here with no edit.
 */
import { spokes } from "../../providers/registry";
import type { ProviderChoice } from "./model";

export async function loadChoices(): Promise<ProviderChoice[]> {
  const map = await spokes();
  const choices = [...map.values()].map(
    (spoke): ProviderChoice => ({
      id: spoke.id,
      label: spoke.label,
      brand: spoke.brand,
      defaultModel: spoke.defaultModel ?? "",
      keyless: spoke.keyless ?? false,
      // Custom and local endpoints supply their own URL. A spoke with its own `chat` makes no HTTP
      // request at all, so asking for one would be a required field with nowhere to go.
      needsBaseURL: !spoke.host && !spoke.chat,
      options: spoke.options ?? [],
    }),
  );
  return choices.sort((a, b) => {
    if (a.id === "custom") return 1;
    if (b.id === "custom") return -1;
    return a.label.localeCompare(b.label);
  });
}
