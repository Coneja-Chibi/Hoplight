// src/ui/tours/workbench/index.ts
var workbenchTour = {
  manifest: { appId: "workbench", title: "Getting started" },
  steps: [
    {
      id: "welcome",
      title: "This is the Workbench",
      body: "Where you build and edit a character. Everything about them lives on this one page. Let me get a character on the bench so you can see it."
    },
    {
      id: "open",
      act: { setPref: { key: "editor.mode", value: "grid" }, open: "piece" },
      title: "Here's the editor",
      body: "This is where every detail lives, laid out as cards you can fill in.",
      bodyBy: {
        opened: "I opened one of your characters. This is where every detail lives, laid out as cards you can fill in.",
        focused: "You already had a character on the bench, so let's use them. Every detail lives here, laid out as cards you can fill in.",
        created: "Your shelf is empty, so I started a blank card for you. Every detail will live here as you fill it in."
      }
    },
    {
      id: "layout",
      anchor: "layout",
      title: "Pick your layout",
      body: "Click Bento or Playbill in the lit-up toggle and watch the fields rearrange. Bento shows them all at once; Playbill turns them into acts you page through."
    },
    {
      id: "mode",
      anchor: "mode",
      title: "Fill it in your way",
      body: "Grid shows every field to edit directly. Steps walks you through like a quiz. Give the toggle a click to feel the difference, your choice sticks."
    },
    {
      id: "portrait",
      anchor: "portrait",
      title: "Their face",
      body: "Drop art in here, or skip it and add it later. The card even borrows its accent color from the picture."
    },
    {
      id: "lens",
      anchor: "lens",
      title: "Aim at a platform",
      body: "Tap the platforms you are building for. Fields that platform cannot carry dim out, so you always know what will travel."
    },
    {
      id: "save",
      anchor: "save",
      title: "Saved as you go",
      body: "Your work is kept on this computer the moment you make it. There is no save button to remember."
    },
    {
      id: "done",
      title: "That is the whole tour",
      body: "Poke around, nothing here can break. Need it again? The ? in the corner replays this any time."
    }
  ]
};
var workbench_default = workbenchTour;
export {
  workbench_default as default
};
