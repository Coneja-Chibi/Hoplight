// src/ui/tours/workbench-pack/index.ts
var packTour = {
  manifest: { appId: "workbench-pack", title: "The pack folder" },
  steps: [
    {
      id: "welcome",
      title: "This is a pack",
      body: "A pack is a folder of expression art: one character's faces (happy, sad, smug) kept together as a piece of its own, so a whole set travels and reuses as one thing."
    },
    {
      id: "grid",
      title: "The face grid",
      body: "Every tile is one labeled face. Drop images on, rename labels to match what platforms expect (joy, anger, surprise), and remove the misfires."
    },
    {
      id: "reuse",
      title: "Packs attach to characters",
      body: "From a character's Manage Sprites, you can pull a pack in whole. Edit the pack here once and every character wearing it gets the update."
    },
    {
      id: "done",
      title: "That is the pack",
      body: "Name and brief up top keep the Library shelf readable when you have ten of these. The ? replays this any time."
    }
  ]
};
var workbench_pack_default = packTour;
export {
  workbench_pack_default as default
};
