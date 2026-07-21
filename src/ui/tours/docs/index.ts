/** First-open walkthrough for finding, reading, and navigating the in-app docs corpus. */
import type { Tour } from "../tour-contract";

const docsTour: Tour = {
  manifest: { appId: "docs", title: "Finding your way" },
  steps: [
    {
      id: "welcome",
      title: "The docs live here too",
      body: "This is the same documentation committed to GitHub, packaged into Hoplight so it is always close by.",
    },
    {
      id: "search",
      anchor: "search",
      title: "Find a page",
      body: "Search titles, summaries, tags, and headings. The navigation is generated from the docs folders.",
    },
    {
      id: "content",
      anchor: "content",
      title: "Read it here",
      body: "Guides, exact reference material, screenshots, and generated diagrams all render in this room.",
    },
    {
      id: "toc",
      anchor: "toc",
      title: "Jump within a page",
      body: "Use the right rail to move between the current page's headings.",
    },
  ],
};

export default docsTour;
