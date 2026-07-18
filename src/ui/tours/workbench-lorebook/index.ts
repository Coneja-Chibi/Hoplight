/**
 * The lorebook binder walkthrough - served by the workbench "?" when a lorebook is the active
 * piece. Copy checked against the binder itself: entry list, entry content + triggers, When and
 * Where, Rehearsal, book settings. Anchor-less; steps narrate, the room stays live.
 */
import type { Tour } from "../tour-contract";

const lorebookTour: Tour = {
  manifest: { appId: "workbench-lorebook", title: "The lorebook binder" },
  steps: [
    {
      id: "welcome",
      title: "This is the binder",
      body: "A lorebook is the world knowledge your character can pull in mid-chat. Each entry is one fact or scene note; the list on the left is every entry in this book.",
    },
    {
      id: "entry",
      title: "One entry at a time",
      body: "Click an entry and the middle is its page: the text that gets injected, and the keywords that wake it. When someone says a trigger word in chat, the entry fires.",
    },
    {
      id: "when-where",
      title: "When and where",
      body: "Every entry also carries placement: where in the prompt it lands and how deep. The defaults are sensible; open an entry's When and Where card only when a platform needs something special.",
    },
    {
      id: "rehearsal",
      title: "Rehearse before the show",
      body: "The Rehearsal pane lets you type a pretend chat line and watch which entries fire, in what order, and what the budget cuts. Test your triggers here instead of live.",
    },
    {
      id: "settings",
      title: "The book's own dials",
      body: "Book settings hold the whole-book knobs: scan depth, token budget, recursion. They apply to every entry unless an entry overrides them.",
    },
    {
      id: "done",
      title: "That is the binder",
      body: "Attach this book to a character from their Knowledge rail, and it travels with them on export. The ? replays this any time.",
    },
  ],
};

export default lorebookTour;
