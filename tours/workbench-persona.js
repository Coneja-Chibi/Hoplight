// src/ui/tours/workbench-persona/index.ts
var personaTour = {
  manifest: { appId: "workbench-persona", title: "The persona editor" },
  steps: [
    {
      id: "welcome",
      title: "This is your persona",
      body: "A persona is who YOU are in the chat: your name, your look, how the model should treat you. It rides beside whatever character you talk to."
    },
    {
      id: "portrait",
      title: "Your face",
      body: "Drop art in the booth or click it to browse. The remove stub takes it back off; nothing here is precious."
    },
    {
      id: "identity",
      title: "Identity first, sections after",
      body: "Tagline, pronouns, height, age up top; appearance, personality, quirks, history as cards below. Fill what you like, skip what you do not; empty sections simply do not travel."
    },
    {
      id: "palette",
      title: "Your colors",
      body: 'Labeled palette colors ride into the prompt as real facts ("hair (#a78bfa)"), so the model can describe you consistently. Unlabeled swatches stay visual notes.'
    },
    {
      id: "injection",
      title: "Watch the real prompt",
      body: "Prompt Injection decides where your persona lands; the Live Preview underneath is the actual compiled text, not a mockup. What you see there is what the model gets."
    },
    {
      id: "done",
      title: "That is the persona",
      body: "The star makes this your default persona for new chats. Write for a platform up top and off-limit fields step aside. The ? replays this any time."
    }
  ]
};
var workbench_persona_default = personaTour;
export {
  workbench_persona_default as default
};
