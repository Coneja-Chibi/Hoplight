/** Doctor version check: report the exact local Hoplight and Bun builds without making network egress. */
import type { DoctorCheck } from "../check";

const check: DoctorCheck = {
  id: "version",
  label: "Version",
  async run(context) {
    return {
      status: "ok",
      detail: `Hoplight ${context.version} · Bun ${context.runtime}`,
    };
  },
};

export default check;
