/** Progressive-disclosure tests for direct, deferred, and hidden capabilities. */
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ParsedCanonicalEntity } from "../runtime-schema";
import { createCapabilityCatalog } from "./catalog";
import {
  initialExposureState,
  revealCapabilities,
  visibleCapabilities,
} from "./exposure";
import type { CapabilityExposure, ContentCapability } from "./types";

const entity = {} as ParsedCanonicalEntity;

function capability(
  id: ContentCapability<Record<string, never>>["id"],
  exposure: CapabilityExposure,
): ContentCapability<Record<string, never>> {
  return {
    id,
    kind: "lorebook",
    area: "entries",
    action: "update",
    summary: id,
    aliases: [],
    platforms: "canonical",
    exposure,
    effect: "draft",
    input: z.object({}),
    concurrencyKey: () => "lorebook/world",
    preview: () => ({ entity, changes: [], warnings: [], platformImpact: [] }),
  };
}

describe("capability exposure", () => {
  const direct = capability("lorebook.entries.read", "direct");
  const deferred = capability("lorebook.entries.update", "deferred");
  const hidden = capability("lorebook.entries.internal", "hidden");
  const catalog = createCapabilityCatalog([direct, deferred, hidden]);

  test("starts with direct capabilities only", () => {
    expect(visibleCapabilities(catalog, initialExposureState()).map((cap) => cap.id))
      .toEqual([direct.id]);
  });

  test("reveals known deferred ids without ever revealing hidden or unknown ids", () => {
    const state = revealCapabilities(catalog, initialExposureState(), [
      deferred.id,
      hidden.id,
      "lorebook.entries.missing",
    ]);
    expect(visibleCapabilities(catalog, state).map((cap) => cap.id))
      .toEqual([direct.id, deferred.id]);
    expect(state.revealedIds).toEqual([deferred.id]);
  });

  test("keeps the cumulative provider-visible deferred set capped at five", () => {
    const deferredCapabilities = Array.from({ length: 6 }, (_, index) =>
      capability(`lorebook.entries.action-${index}`, "deferred"));
    const broadCatalog = createCapabilityCatalog(deferredCapabilities);
    const first = revealCapabilities(
      broadCatalog,
      initialExposureState(),
      deferredCapabilities.slice(0, 4).map((item) => item.id),
    );
    const second = revealCapabilities(
      broadCatalog,
      first,
      deferredCapabilities.slice(4).map((item) => item.id),
    );
    expect(second.revealedIds).toEqual(
      deferredCapabilities.slice(0, 5).map((item) => item.id),
    );
  });
});
