/** Doctor vault check: report the actual sealing backend and whether a saved provider is active. */
import type { DoctorCheck } from "../check";

const check: DoctorCheck = {
  id: "vault",
  label: "Vault",
  async run(context, signal) {
    const vault = await context.vault(signal);
    // A recovered vault also reports zero providers, so this has to come first or the incident
    // reads as an ordinary empty vault.
    if (vault.notice) return { status: "warn", detail: vault.notice };
    if (vault.providers === 0) {
      return { status: "warn", detail: `ready with ${vault.backend}; no saved providers` };
    }
    return {
      status: vault.active ? "ok" : "warn",
      detail: `sealed with ${vault.backend} · ${String(vault.providers)} saved · ${
        vault.active ? "active" : "none active"
      }`,
    };
  },
};

export default check;
