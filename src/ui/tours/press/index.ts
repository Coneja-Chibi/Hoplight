/**
 * The Press tour - the staging-grammar room (vs-press-room-1). Copy matches the built room: stage
 * from the Library or the left rail, kits with riders, readiness lines, one target, the single zip.
 */
import type { Tour } from "../tour-contract";

const pressTour: Tour = {
  manifest: { appId: "press", title: "The Press" },
  steps: [
    {
      id: "welcome",
      title: "This is the Press",
      body: "The print room for whole runs. One piece at a time still lives on each editor's Export button; this room prints the staged set.",
    },
    {
      id: "stage",
      title: "Stage your pieces",
      body: "Right-click any piece in the Library and choose Stage for the Press, or click a stamp on the left rail. The queue survives app switches.",
    },
    {
      id: "kits",
      title: "Characters travel as kits",
      body: "A staged character brings his linked lorebooks along as riders. Drop a rider from one run without unlinking anything; it rides again next time.",
    },
    {
      id: "readiness",
      title: "Every card tells the truth",
      body: "Each staged piece shows how much of it the target platform will actually carry, and names what is empty. A lorebook whose entries have no keywords says so in red.",
    },
    {
      id: "run",
      title: "One platform, one lever",
      body: "Pick where this run is going, then run the press. Each card prints its honest result: printed with what it carries, skipped with the reason, or failed with the error.",
    },
    {
      id: "done",
      title: "One bundle out",
      body: "Everything that printed lands in a single zip, named for the platform. The ? replays this any time.",
    },
  ],
};

export default pressTour;
