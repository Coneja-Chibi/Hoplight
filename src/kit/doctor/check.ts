/**
 * Doctor's drop-in check contract and injected read-only dependencies. Checks cannot write; the
 * runner owns timeout/error conversion and returns one stable row per discovered file.
 */
import type { EntitySummary } from "../bridge";

export type DoctorStatus = "ok" | "warn" | "fail";

export interface DoctorResult {
  id: string;
  label: string;
  status: DoctorStatus;
  detail: string;
}

export interface ProviderDiagnostic {
  name: string;
  model: string;
  text: string;
  ms: number;
}

export interface VaultDiagnostic {
  backend: string;
  providers: number;
  active: boolean;
}

export interface DoctorContext {
  pieces(signal?: AbortSignal): Promise<EntitySummary[]>;
  provider(signal?: AbortSignal): Promise<ProviderDiagnostic | null>;
  vault(signal?: AbortSignal): Promise<VaultDiagnostic>;
  version: string;
  runtime: string;
}

export interface DoctorCheck {
  id: string;
  label: string;
  run(
    context: DoctorContext,
    signal: AbortSignal,
  ): Promise<Pick<DoctorResult, "status" | "detail">>;
}
