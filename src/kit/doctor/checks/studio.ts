/** Doctor studio check: prove the bound canonical store can enumerate its current pieces. */
import type { DoctorCheck } from "../check";

const check: DoctorCheck = {
  id: "studio",
  label: "Studio",
  async run(context, signal) {
    const pieces = await context.pieces(signal);
    return {
      status: "ok",
      detail: `${String(pieces.length)} pieces readable`,
    };
  },
};

export default check;
