/**
 * Session-local capability registry with a complete dispatch set and a progressive model snapshot.
 */
import {
  createCapabilityCatalog,
  initialExposureState,
  revealCapabilities,
  searchCapabilities,
  visibleCapabilities,
  type CapabilitySearchHit,
  type CapabilitySearchQuery,
  type ContentCapability,
} from "../../entities/capabilities";
import type { ChangeSession } from "../changes/session";
import { toolSpecs } from "../loop/dispatch";
import type { ToolSpec } from "../providers/provider";
import type { HarnessTool } from "../tools/tool";
import { capabilityToHarnessTool } from "./adapter";

export interface CapabilityRuntime {
  /** Complete registry used by dispatch, including capabilities not shown to the model. */
  registeredTools(): readonly HarnessTool[];
  /** Current direct and successfully revealed provider specifications. */
  toolSnapshot(): ToolSpec[];
  /** Search and reveal at most five matching deferred capabilities for the next snapshot. */
  find(request: CapabilitySearchQuery): CapabilitySearchHit[];
}

export interface CapabilityRuntimeOptions {
  capabilities: readonly ContentCapability[];
  directTools: readonly HarnessTool[];
  changes: ChangeSession;
}

/** Create one isolated capability exposure scope for one Kit session. */
export function createCapabilityRuntime(
  options: CapabilityRuntimeOptions,
): CapabilityRuntime {
  const catalog = createCapabilityCatalog(options.capabilities);
  const adapted = catalog.all().map((capability) =>
    capabilityToHarnessTool(capability, options.changes));
  const adaptedById = new Map(
    catalog.all().map((capability, index) => [capability.id, adapted[index]!]),
  );
  const registered = [...options.directTools, ...adapted];
  let exposure = initialExposureState();

  return {
    registeredTools: () => registered,

    toolSnapshot() {
      const base = options.directTools.filter((tool) => tool.exposure === "direct");
      const revealed = visibleCapabilities(catalog, exposure)
        .map((capability) => adaptedById.get(capability.id))
        .filter((tool): tool is HarnessTool => tool !== undefined);
      return toolSpecs([...base, ...revealed]);
    },

    find(request) {
      const hits = searchCapabilities(catalog, request);
      exposure = revealCapabilities(
        catalog,
        exposure,
        hits.map((hit) => hit.capability.id),
      );
      return hits;
    },
  };
}
