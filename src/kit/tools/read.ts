/**
 * Read tool: open one piece and hand its canonical content to the model. Wraps the bridge read seam.
 */
import { z } from "zod";
import type { HarnessTool } from "./tool";
import { renderEntity } from "./_shared/format";
import { STUDIO_ENTITY_KINDS } from "../../studio/path-policy";

const input = z.object({
  kind: z.enum(STUDIO_ENTITY_KINDS).describe("the deck the piece lives in"),
  id: z.string().min(1).describe("the piece's id (its filename without .json)"),
});

const read: HarnessTool<z.infer<typeof input>> = {
  name: "read",
  description: "Open one piece by kind and id and read its full canonical content.",
  input,
  async execute({ kind, id }, { bridge }) {
    const entity = await bridge.read(kind, id);
    if (!entity) {
      return { summary: `read ${kind}/${id}: not found`, output: `No ${kind} with id "${id}" in the studio.` };
    }
    return { summary: `read ${kind}/${id}`, output: renderEntity(entity) };
  },
};

export default read;
