/**
 * Semantic capability for character variant lifecycle and explicit inheritance.
 * Field values are edited through the normal semantic bundles with target.variantId.
 */
import { z } from "zod";
import type { CapabilityChange, ContentCapability } from "../../capabilities";
import type { CanonicalCharacter, CharacterVariant } from "../schema";
import {
  addVariant,
  inheritVariantField,
  removeVariant,
  setVariantLabel,
  setVariantMode,
  variantsOf,
} from "../variant-edit";
import { targetSchema } from "./shared";

const operation = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("add"),
    id: z.string().min(1),
    label: z.string().nullable().optional(),
    mode: z.enum(["mirror", "full"]).optional(),
  }),
  z.strictObject({ type: z.literal("remove"), id: z.string().min(1) }),
  z.strictObject({
    type: z.literal("rename"),
    id: z.string().min(1),
    label: z.string().nullable(),
  }),
  z.strictObject({
    type: z.literal("set-mode"),
    id: z.string().min(1),
    mode: z.enum(["mirror", "full"]),
  }),
  z.strictObject({
    type: z.literal("inherit-field"),
    id: z.string().min(1),
    path: z.string().min(1),
  }),
]);
const input = z.strictObject({ target: targetSchema, operation });
type Operation = z.infer<typeof operation>;

const find = (entity: CanonicalCharacter, id: string): CharacterVariant | undefined =>
  variantsOf(entity.body).find((variant) => variant.id === id);

function applyOperation(entity: CanonicalCharacter, action: Operation): CanonicalCharacter {
  switch (action.type) {
    case "add":
      return {
        ...entity,
        body: addVariant(
          entity.body,
          action.id,
          action.label ?? undefined,
          action.mode === undefined ? undefined : action.mode === "mirror",
        ),
      };
    case "remove":
      return { ...entity, body: removeVariant(entity.body, action.id) };
    case "rename":
      return {
        ...entity,
        body: setVariantLabel(entity.body, action.id, action.label ?? undefined),
      };
    case "set-mode":
      return {
        ...entity,
        body: setVariantMode(entity.body, action.id, action.mode === "mirror"),
      };
    case "inherit-field":
      return {
        ...entity,
        body: inheritVariantField(entity.body, action.id, action.path),
      };
  }
}

function changeFor(
  before: CanonicalCharacter,
  after: CanonicalCharacter,
  action: Operation,
): CapabilityChange {
  const beforeVariant = find(before, action.id);
  const afterVariant = find(after, action.id);
  if (action.type === "rename") {
    return {
      path: `body.variants[id=${action.id}].label`,
      label: "variant label",
      before: beforeVariant?.label,
      after: afterVariant?.label,
    };
  }
  if (action.type === "set-mode") {
    return {
      path: `body.variants[id=${action.id}].mirrorBase`,
      label: "variant mode",
      before: beforeVariant?.mirrorBase,
      after: afterVariant?.mirrorBase,
    };
  }
  if (action.type === "inherit-field") {
    return {
      path: `body.variants[id=${action.id}].overrides.${action.path}`,
      label: "inherit variant field",
      before: beforeVariant?.overrides,
      after: afterVariant?.overrides,
    };
  }
  return {
    path: `body.variants[id=${action.id}]`,
    label: action.type === "add" ? "add variant" : "remove variant",
    before: beforeVariant,
    after: afterVariant,
  };
}

const capability: ContentCapability<z.infer<typeof input>, CanonicalCharacter> = {
  id: "character.variants.manage",
  kind: "character",
  area: "variants",
  action: "manage",
  summary: "Add, remove, rename, configure, or restore inheritance for a character variant.",
  aliases: ["alternate character", "variant mode", "use base field", "remove variant"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `character/${target.id}`,
  preview: (entity, { operation: action }) => {
    const updated = applyOperation(entity, action);
    return {
      entity: updated,
      changes: [changeFor(entity, updated, action)],
      warnings: [],
      platformImpact: [],
    };
  },
};

export default capability;
