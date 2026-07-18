/**
 * The Press tour - the Job Sheet room (vs-press option 1). Copy matches the built room: the studio
 * tray, one target platform per run, honest per-row results, the single zip.
 */
import type { Tour } from "../tour-contract";

const pressTour: Tour = {
  manifest: { appId: "press", title: "The Press" },
  steps: [
    {
      id: "welcome",
      title: "This is the Press",
      body: "The export desk for whole runs. One piece at a time still lives on each editor's Export button; this room prints batches.",
    },
    {
      id: "tray",
      title: "The studio tray",
      body: "Everything you own, by kind, with counts. Tick single pieces or a whole group at once; the job sheet fills as you pick.",
    },
    {
      id: "target",
      title: "One platform per run",
      body: "Pick where this run is going. A piece the platform cannot print shows as skipped up front, before you run, never as a surprise after.",
    },
    {
      id: "run",
      title: "Run the press",
      body: "Each row prints its honest result as it lands: printed with what it carries, skipped with the reason, or failed with the error. Nothing is summarized away.",
    },
    {
      id: "done",
      title: "One bundle out",
      body: "Everything that printed lands in a single zip, named for the platform. The ? replays this any time.",
    },
  ],
};

export default pressTour;
