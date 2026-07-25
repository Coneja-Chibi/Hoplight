/**
 * Session-local capability registry with a complete dispatch set and a progressive model snapshot.
 */
import {
  createCapabilityDescriptorCatalog,
  createCapabilityCatalog,
  browseCapabilities,
  describeCapability,
  describeContentCapability,
  initialExposureState,
  revealCapabilities,
  searchCapabilities,
  visibleCapabilities,
  type CapabilityDescriptor,
  type CapabilitySearchQuery,
  type CapabilityBrowseRequest,
  type CapabilityBrowseResult,
  type CapabilityDescribeRequest,
  type ContentCapability,
} from "../../entities/capabilities";
import type { ChangeSession } from "../changes/session";
import { assertUniqueToolNames, toolSpecs } from "../loop/dispatch";
import type { ToolSpec } from "../providers/provider";
import type { HarnessTool } from "../tools/tool";
import { capabilityToHarnessTool } from "./adapter";

export interface CapabilityRuntime {
  /** Complete registry used by dispatch, including capabilities not shown to the model. */
  registeredTools(): readonly HarnessTool[];
  /** Validated metadata used by exposure and the safety-owned exact-name resolver. */
  descriptors(): readonly CapabilityDescriptor[];
  /** Current direct and successfully revealed provider specifications. */
  toolSnapshot(): ToolSpec[];
  /** Search and reveal at most five matching deferred capabilities for the next snapshot. */
  find(request: CapabilitySearchQuery): Array<{
    descriptor: CapabilityDescriptor;
    score: number;
  }>;
  /** Browse collapsed metadata without changing the model-visible tool set. */
  browse(request: CapabilityBrowseRequest): CapabilityBrowseResult;
  /** Select and reveal exactly one available capability for the next snapshot. */
  describe(request: CapabilityDescribeRequest): CapabilityDescriptor | null;
  /** Clear deferred tools at the start of each user turn. */
  beginTurn(): void;
}

export interface CapabilityRuntimeOptions {
  capabilities: readonly ContentCapability[];
  directTools: readonly HarnessTool[];
  changes: ChangeSession;
}

const toolDescriptor = (tool: HarnessTool): CapabilityDescriptor | null => {
  if (!tool.discovery) return null;
  if (tool.effect === "apply") {
    throw new Error(
      `${tool.discovery.id}: deferred apply workflows require an explicit safety contract`,
    );
  }
  return {
    ...tool.discovery,
    toolName: tool.name,
    exposure: tool.exposure,
    effect: tool.effect,
  };
};

/** Create one isolated capability exposure scope for one Kit session. */
export function createCapabilityRuntime(
  options: CapabilityRuntimeOptions,
): CapabilityRuntime {
  const catalog = createCapabilityCatalog(options.capabilities);
  const adapted = catalog.all().map((capability) =>
    capabilityToHarnessTool(capability, options.changes));
  const contentDescriptors = catalog.all().map(describeContentCapability);
  const workflowDescriptors = options.directTools
    .map(toolDescriptor)
    .filter((descriptor): descriptor is CapabilityDescriptor => descriptor !== null);
  const discovery = createCapabilityDescriptorCatalog([
    ...contentDescriptors,
    ...workflowDescriptors,
  ]);
  const toolByDescriptorId = new Map<string, HarnessTool>();
  contentDescriptors.forEach((descriptor, index) => {
    toolByDescriptorId.set(descriptor.id, adapted[index]!);
  });
  workflowDescriptors.forEach((descriptor) => {
    const tool = options.directTools.find((candidate) =>
      candidate.name === descriptor.toolName);
    if (tool) toolByDescriptorId.set(descriptor.id, tool);
  });
  const registered = [...options.directTools, ...adapted];
  assertUniqueToolNames(registered);
  let exposure = initialExposureState();

  return {
    registeredTools: () => registered,
    descriptors: () => discovery.all(),

    toolSnapshot() {
      const base = options.directTools.filter((tool) => tool.exposure === "direct");
      const revealed = visibleCapabilities(discovery, exposure)
        .map((descriptor) => toolByDescriptorId.get(descriptor.id))
        .filter((tool): tool is HarnessTool => tool !== undefined);
      return toolSpecs([...new Map(
        [...base, ...revealed].map((tool) => [tool.name, tool]),
      ).values()]);
    },

    find(request) {
      const hits = searchCapabilities(discovery, request);
      exposure = revealCapabilities(
        discovery,
        exposure,
        hits.map((hit) => hit.capability.id),
      );
      return hits.map((hit) => ({
        descriptor: hit.capability,
        score: hit.score,
      }));
    },

    browse(request) {
      return browseCapabilities(discovery, request);
    },

    describe(request) {
      const descriptor = describeCapability(discovery, request);
      exposure = revealCapabilities(
        discovery,
        exposure,
        descriptor ? [descriptor.id] : [],
      );
      return descriptor;
    },

    beginTurn() {
      exposure = initialExposureState();
    },
  };
}
