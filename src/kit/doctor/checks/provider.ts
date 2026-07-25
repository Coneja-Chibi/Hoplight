/** Doctor provider check: the same real ping path as /test, bounded by the doctor runner. */
import type { DoctorCheck } from "../check";

const check: DoctorCheck = {
  id: "provider",
  label: "Provider",
  async run(context, signal) {
    const result = await context.provider(signal);
    if (!result) return { status: "warn", detail: "no provider connected" };
    return {
      status: "ok",
      detail: `${result.name} · ${result.model} · ${result.ms}ms`,
    };
  },
};

export default check;
