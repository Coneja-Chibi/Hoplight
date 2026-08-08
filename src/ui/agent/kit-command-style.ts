/**
 * The stylesheet for the slash-command surfaces: the listing, the doctor, the shelf, and the popup.
 *
 * ITS OWN FILE for the reason kit-transcript-style.ts is: these rules belong beside the components
 * that use them, and the transcript stylesheet is already at the length where finding a rule means
 * scrolling past four unrelated widgets.
 *
 * EVERY COLOUR IS `var(--kit-*)`, emitted at runtime from Kit's own theme. TEXT FLOORS AT `quiet`
 * and `mut` is only ever a border, which is theme.ts's rule and the one this window keeps.
 */

/** A titled listing: /help, /tools, /session, the rewind picker. */
export const KIT_LIST_STYLE = `
.kit-list{display:flex;flex-direction:column;gap:.3rem;border-left:2px solid var(--kit-teal);
  background:var(--kit-recess);padding:.45rem .55rem}
.kit-list__head{font-family:var(--font-mono);font-size:.62rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--kit-quiet)}
.kit-list__rows{display:flex;flex-direction:column}
/* A row is a grid so every label column lines up: a listing whose second column wanders is a
   listing nobody scans. */
.kit-list__row{display:grid;grid-template-columns:minmax(6rem,auto) 1fr;gap:.55rem;align-items:baseline;
  padding:.16rem .2rem;text-align:left;background:none;border:0;font:inherit;width:100%}
.kit-list__row--act{cursor:pointer}
.kit-list__row--act:hover,.kit-list__row--act:focus-visible{background:var(--kit-lift);outline:none}
/* Kit's CLI signature: a bright key, a muted label. */
.kit-list__key{font-family:var(--font-mono);font-size:.76rem;color:var(--kit-bright);
  overflow-wrap:anywhere}
.kit-list__note{font-size:.76rem;color:var(--kit-quiet);overflow-wrap:anywhere}
.kit-list__hint{margin:.15rem 0 0;font-size:.72rem;line-height:1.45;color:var(--kit-quiet)}
`;

/** The diagnostic playbill. */
export const KIT_DOCTOR_STYLE = `
.kit-doctor{display:flex;flex-direction:column;gap:.2rem;background:var(--kit-recess);
  padding:.45rem .55rem}
/* The spine carries the status, so risk is legible before any of the words are - the same rule a
   tool row's verb colour follows. The colour itself is set inline, per row. */
.kit-doctor__row{display:grid;grid-template-columns:3rem minmax(5rem,auto) 1fr;gap:.5rem;
  align-items:baseline;border-left:2px solid var(--kit-mut);padding:.16rem .5rem}
.kit-doctor__mark{font-family:var(--font-mono);font-size:.62rem;letter-spacing:.1em;
  text-transform:uppercase}
`;

/** A picture, or a shelf of them. */
export const KIT_SHELF_STYLE = `
.kit-shelf{display:flex;flex-direction:column;gap:.3rem;border-left:2px solid var(--kit-violet);
  background:var(--kit-recess);padding:.45rem .55rem}
/* Scrolls sideways rather than reflowing: a shelf is a row of faces, and a shelf that wraps into a
   block stops reading as one. */
.kit-shelf__strip{display:flex;gap:.5rem;overflow-x:auto;padding-bottom:.2rem}
.kit-shelf__frame{margin:0;display:flex;flex-direction:column;gap:.2rem;flex:0 0 auto;
  max-width:min(15rem,60%)}
.kit-shelf__frame img{display:block;width:100%;height:auto;max-height:14rem;object-fit:contain;
  border:1px solid var(--kit-line);background:var(--kit-sunken)}
.kit-shelf__frame figcaption{font-size:.7rem;color:var(--kit-quiet);overflow-wrap:anywhere}
`;

/**
 * A command's output in the transcript, and the box the popup hangs off.
 *
 * NO SPINE AND NO LIFT on a command line: it is not somebody's turn, so it must not wear the band
 * that says one. The widgets inside carry their own left edge.
 */
export const KIT_COMMAND_LINE_STYLE = `
.agent-room__line--kit{padding:.3rem .7rem;background:var(--kit-well)}
/* The popup anchors here rather than on the form, so composer key styling cannot reach its rows. */
.agent-room__compose{position:relative;flex:none}
`;

/** The completion popup above the composer. */
export const KIT_SLASH_STYLE = `
.kit-slash{position:absolute;left:.7rem;right:.7rem;bottom:100%;z-index:3;
  display:flex;flex-direction:column;max-height:13rem;overflow-y:auto;
  background:var(--kit-panel);border:1px solid var(--kit-line)}
.kit-slash__head{font-family:var(--font-mono);font-size:.6rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--kit-quiet);padding:.25rem .45rem;
  border-bottom:1px solid var(--kit-seam)}
.kit-slash__row{display:grid;grid-template-columns:minmax(5.5rem,auto) 1fr;gap:.5rem;
  align-items:baseline;padding:.22rem .45rem;text-align:left;background:none;border:0;font:inherit;
  cursor:pointer;width:100%}
/* The highlight is the raised band, which is what Kit lifts an active list row with. */
.kit-slash__row--on{background:var(--kit-lift)}
.kit-slash__word{font-family:var(--font-mono);font-size:.76rem;color:var(--kit-bright)}
.kit-slash__say{font-size:.74rem;color:var(--kit-quiet);overflow-wrap:anywhere}
`;

export const KIT_COMMAND_STYLE =
  KIT_LIST_STYLE + KIT_DOCTOR_STYLE + KIT_SHELF_STYLE + KIT_COMMAND_LINE_STYLE + KIT_SLASH_STYLE;
