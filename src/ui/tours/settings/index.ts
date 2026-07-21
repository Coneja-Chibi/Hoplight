/**
 * The Settings tour - same drop-in chassis as the workbench/library tours, pure data. Settings is
 * three registry-driven sections (appearance, studio, workbench); the copy narrates what each tab
 * really does and promises nothing more. Anchor-less on purpose: the room is one tab bar and its
 * cards, so centered steps read fine without highlights.
 */
import type { Tour } from "../tour-contract";

const settingsTour: Tour = {
  manifest: { appId: "settings", title: "Settings" },
  steps: [
    {
      id: "welcome",
      title: "This is Settings",
      body: "Every knob for the whole studio lives here, grouped into tabs. Changes apply the moment you make them, no apply button, no restart.",
    },
    {
      id: "appearance",
      title: "Appearance",
      body: "Theme and accent color. The same theme switch also sits in the top strip; this tab remembers whatever you pick, wherever you pick it.",
    },
    {
      id: "studio",
      title: "Studio",
      body: "The big choices from your first-run setup, changeable any time: which room Hoplight opens in, which deck greets you, and the platforms you publish to.",
    },
    {
      id: "workbench",
      title: "Workbench",
      body: "How editing feels: Bento or Playbill layout, Grid or Steps for filling things in, and whether sending a piece walks you over to it or leaves you where you are.",
    },
    {
      id: "done",
      title: "That is all of it",
      body: "Nothing in here can break your work. The ? in the corner replays this any time.",
    },
  ],
};

export default settingsTour;
