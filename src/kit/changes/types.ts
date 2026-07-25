/**
 * In-memory change-draft state owned by one Kit session.
 */
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import type {
  CapabilityChange,
  CapabilityPlatformImpact,
  ContentKind,
} from "../../entities/capabilities";

export type ChangeDraftStatus =
  | "draft"
  | "applying"
  | "applied"
  | "stale"
  | "discarded"
  | "failed";

export interface ChangeTarget {
  kind: ContentKind;
  id: string;
  revision: string;
}

export interface ChangeOperation {
  capabilityId: string;
  input: unknown;
  changes: readonly CapabilityChange[];
  warnings: readonly string[];
  platformImpact: readonly CapabilityPlatformImpact[];
}

export interface ChangeDraft {
  id: string;
  target: ChangeTarget;
  baseline: ParsedCanonicalEntity;
  proposed: ParsedCanonicalEntity;
  operations: readonly ChangeOperation[];
  warnings: readonly string[];
  platformImpact: readonly CapabilityPlatformImpact[];
  status: ChangeDraftStatus;
}

export interface ChangeReceipt {
  draftId: string;
  target: ChangeTarget | null;
  status: "applied" | "stale" | "discarded" | "failed";
  operationCount: number;
  changeCount: number;
  detail: string;
}
