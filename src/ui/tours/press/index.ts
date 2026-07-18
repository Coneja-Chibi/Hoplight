/**
 * The Press wayfinding tour - honest about the placeholder (lit-vs-ghost law: never tour a fake
 * feature) and points at where exporting actually lives today (each editor's Export button).
 */
import type { Tour } from "../tour-contract";

const pressTour: Tour = {
  manifest: { appId: "press", title: "The Press" },
  steps: [
    {
      id: "welcome",
      title: "The Press is not built yet",
      body: "This room will become the export desk: batch conversions, whole-studio printing, publish runs. It is honestly empty today, not hiding anything.",
    },
    {
      id: "today",
      title: "Exporting works right now",
      body: "Open any piece on the Workbench and press its Export button: pick a platform, see what travels and what cannot, and save the file. The Press will collect those flows here later.",
    },
  ],
};

export default pressTour;
