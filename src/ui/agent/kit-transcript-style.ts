/**
 * The stylesheet for the transcript widgets, in Kit's own visual language.
 *
 * A SEPARATE FILE FROM apps/agent/styles.ts, for two reasons. The obvious one is the line cap: that
 * file already carries the window's chrome and would not fit this. The better one is that these
 * rules belong to the components beside them - the markdown renderer, the bands, the meters, the
 * ask panel all live in this folder, and their CSS living somewhere else is how a class name and
 * the rule that draws it drift apart.
 *
 * EVERY COLOUR IS `var(--kit-*)`, emitted from src/kit/render/theme.ts at runtime by kit-vars.ts.
 * There is one palette and this surface cannot fall behind it.
 *
 * TEXT FLOORS AT `quiet`, AND `mut` IS ONLY EVER A BORDER. theme.ts states that rule and Kit's own
 * markdown renderer breaks it - it paints list markers, quote bars and rules as `mut` TEXT, because
 * a terminal has no borders and every mark it can make is a character. A browser does have borders,
 * so here those three ARE borders and every remaining glyph is at least `quiet`.
 */

/** Markdown: the blocks a reply is made of. */
export const KIT_MD_STYLE = `
.kit-md{display:flex;flex-direction:column;gap:.4rem}
.kit-md p{margin:0}
.kit-md__p{font-size:.83rem;line-height:1.55;color:var(--kit-soft);overflow-wrap:anywhere}
/* Every heading level renders the same: bright and heavy. \`######\` is not a volume control. */
.kit-md__head{font-family:var(--font-big);font-weight:900;font-size:.9rem;line-height:1.3;
  color:var(--kit-bright);margin-top:.15rem}
.kit-md__b{color:var(--kit-text);font-weight:700}
.kit-md__i{color:var(--kit-soft);font-style:italic}
/* Inline code: Kit's gold on the sunken field fill, the same slab colour a fence gets. */
.kit-md__code{background:var(--kit-sunken);color:var(--kit-gold);font-family:var(--font-mono);
  font-size:.76rem;padding:0 .2rem;overflow-wrap:anywhere}
.kit-md__link{color:var(--kit-teal);text-decoration:underline;overflow-wrap:anywhere}
/* A refused link keeps its words and loses its click, so a reader can see a link was attempted. */
.kit-md__deadlink{color:var(--kit-quiet);text-decoration:line-through}

.kit-md__li{font-size:.83rem;line-height:1.5;color:var(--kit-soft);overflow-wrap:anywhere}
/* The marker is TEXT, so it floors at \`quiet\` rather than sitting in the border grey Kit uses. */
.kit-md__mark{color:var(--kit-quiet);font-family:var(--font-mono)}
/* The quote bar is a real border in \`mut\`, which is what \`mut\` is for. */
.kit-md__quote{border-left:2px solid var(--kit-mut);padding-left:.5rem;font-style:italic;
  font-size:.83rem;line-height:1.5;color:var(--kit-soft)}
.kit-md__rule{border:0;border-top:1px solid var(--kit-div);margin:.2rem 0}

/* A code slab: the recessed field fill IS the slab, exactly as in the terminal. */
.kit-md__slab{display:flex;flex-direction:column;margin:0;background:var(--kit-sunken);
  border:1px solid var(--kit-line);padding:.4rem .5rem;font-family:var(--font-mono);
  font-size:.72rem;line-height:1.45;color:var(--kit-teal);white-space:pre;overflow-x:auto}
.kit-md__lang{color:var(--kit-quiet);font-size:.62rem;letter-spacing:.1em;text-transform:uppercase}
.kit-md__difflabel{color:var(--kit-bright);font-weight:700;margin-bottom:.15rem}
.kit-md__diffline{white-space:pre}
.kit-md__more{color:var(--kit-quiet);margin-top:.15rem}
`;

/** Bands: the copy corner, the fold line, the failure row, the toast. */
export const KIT_BAND_STYLE = `
/* Positioned so the corner can layer without pushing a single row down. */
.kit-band{position:relative}
.agent-room__body{position:relative;display:flex;flex-direction:column;gap:.1rem}
.agent-room__said{margin:0;font-size:.83rem;line-height:1.55;color:var(--kit-soft);
  white-space:pre-wrap;overflow-wrap:anywhere}
.agent-room__line--user .agent-room__said{color:var(--kit-text)}
.agent-room__line--tool .agent-room__said{font-family:var(--font-mono);font-size:.74rem}

/* HOVER-ONLY AND LAYERED. A control that took a row would move every message down the moment a
   mouse crossed it, and a transcript that reflows under the pointer is one you cannot read. */
.kit-band__copy{position:absolute;top:0;right:0;opacity:0;background:var(--kit-panel);
  border:1px solid var(--kit-line);color:var(--kit-quiet);font-family:var(--font-mono);
  font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;padding:.1rem .35rem;
  cursor:pointer}
.kit-band:hover .kit-band__copy,.kit-band__copy:focus-visible{opacity:1}
.kit-band__copy:hover{color:var(--kit-text);background:var(--kit-lift)}

/* The folded reply: one indented row, never a full-width block of its own. */
.kit-fold{display:block;width:100%;text-align:left;background:none;border:0;cursor:pointer;
  padding:.2rem .7rem .2rem 1.4rem;font-family:var(--font-mono);font-size:.7rem;
  color:var(--kit-quiet)}
.kit-fold:hover{color:var(--kit-soft)}
.kit-fold__dot{color:var(--kit-teal-deep)}

/* A failure: a red spine and a bang, so it never reads as something the agent said. */
.kit-error{margin:.2rem .7rem;background:var(--kit-recess);border-left:2px solid var(--kit-red);
  padding:.45rem .6rem}
.kit-error__text{margin:0;font-size:.78rem;line-height:1.5;color:var(--kit-soft);
  white-space:pre-wrap;overflow-wrap:anywhere}
.kit-error__bang{color:var(--kit-red);font-weight:700}

/* The toast: the outcome of a local gesture, not something anybody said. */
.kit-toast{padding:.15rem .7rem;font-family:var(--font-mono);font-size:.66rem;
  color:var(--kit-soft);flex:none}
.kit-toast__dot{color:var(--kit-teal)}
`;

/** The meters, drawn with characters so a screenshot of one is a screenshot of the other. */
export const KIT_METER_STYLE = `
.kit-meterbar{display:flex;align-items:center;gap:.5rem;background:var(--kit-panel);
  border-bottom:1px solid var(--kit-seam);padding:.15rem .7rem;font-family:var(--font-mono);
  font-size:.64rem;color:var(--kit-soft);flex:none;overflow-x:auto;white-space:nowrap}
.kit-meterbar__gap{flex:1 1 auto}
.kit-meter,.kit-tally{white-space:pre}
/* The label and the unlit cells are the quietest legible text, never the border grey. */
.kit-meter__label{color:var(--kit-quiet)}
.kit-meter__rule{color:var(--kit-quiet)}
.kit-meter__pct{color:var(--kit-text)}
.kit-meter__crit{color:var(--kit-rose)}
.kit-tally--dim{color:var(--kit-quiet)}
`;

/** The ask panel: a question you answer in two visible steps. */
export const KIT_ASK_STYLE = `
.kit-ask{display:flex;flex-direction:column;margin:.35rem 0 .1rem;
  border-left:2px solid var(--kit-teal);background:var(--kit-recess)}
.kit-ask__head{display:flex;justify-content:space-between;background:var(--kit-panel);
  padding:.2rem .5rem;font-family:var(--font-mono);font-size:.56rem;letter-spacing:.18em;
  color:var(--kit-quiet)}
.kit-ask__q{margin:0;padding:.35rem .5rem;font-size:.82rem;line-height:1.45;color:var(--kit-text)}
.kit-ask__rule{height:1px;background:var(--kit-div);margin:.15rem .5rem}

.kit-ask__opt{display:flex;flex-direction:column}
.kit-ask__opt--on{background:var(--kit-lift)}
.kit-ask__pick{display:flex;gap:.3rem;align-items:baseline;width:100%;text-align:left;
  background:none;border:0;cursor:pointer;padding:.2rem .5rem;font-family:var(--font-mono);
  font-size:.76rem;color:var(--kit-soft)}
.kit-ask__pick:disabled{cursor:not-allowed;color:var(--kit-quiet)}
.kit-ask__caret{color:var(--kit-teal);width:1ch;flex:none}
.kit-ask__num{color:var(--kit-quiet);flex:none}
.kit-ask__val{color:var(--kit-soft);overflow-wrap:anywhere}
.kit-ask__opt--on .kit-ask__val{color:var(--kit-text)}
/* The escapes read quieter than the answers: they are ways out, not things that answer. */
.kit-ask__esc{color:var(--kit-quiet);font-style:italic}
.kit-ask__note{margin:0;padding:0 .5rem .2rem 2.1rem;font-size:.72rem;line-height:1.4;
  color:var(--kit-quiet)}
.kit-ask__own,.kit-ask__noteField{margin:.15rem .5rem .25rem;background:var(--kit-sunken);
  border:1px solid var(--kit-line);color:var(--kit-text);font-family:var(--font-body);
  font-size:.76rem;padding:.2rem .4rem}
.kit-ask__own::placeholder,.kit-ask__noteField::placeholder{color:var(--kit-quiet)}
.kit-ask__own:focus,.kit-ask__noteField:focus{outline:none;border-color:var(--kit-teal)}

/* What the button will send, spelled out before it goes. */
.kit-ask__arm{display:flex;align-items:center;gap:.4rem;justify-content:space-between;
  padding:.25rem .5rem;background:var(--kit-recess)}
.kit-ask__arm--ready{background:var(--kit-panel)}
.kit-ask__armText{font-family:var(--font-mono);font-size:.66rem;color:var(--kit-quiet);
  overflow-wrap:anywhere}
.kit-ask__arm--ready .kit-ask__armText{color:var(--kit-soft)}
.kit-ask__send{flex:none;background:var(--kit-floor);border:1px solid var(--kit-teal-deep);
  color:var(--kit-teal);font-family:var(--font-mono);font-weight:700;font-size:.62rem;
  letter-spacing:.08em;text-transform:uppercase;padding:.22rem .6rem;cursor:pointer}
.kit-ask__send:hover:not(:disabled){background:var(--kit-lift);color:var(--kit-text)}
.kit-ask__send:disabled{color:var(--kit-quiet);border-color:var(--kit-line);cursor:not-allowed}

/* An answered panel collapses to what was said: live options in the scrollback invite answering
   the same question twice, and the model has already moved on. */
.kit-ask--done{border-left-color:var(--kit-teal-deep)}
.kit-ask__q--done{color:var(--kit-quiet);font-size:.76rem;padding-bottom:.1rem}
.kit-ask__said{margin:0;padding:0 .5rem .3rem;font-size:.78rem;color:var(--kit-soft)}
`;

/** Everything this folder draws, in one string for the room to inject. */
export const KIT_TRANSCRIPT_STYLE =
  KIT_MD_STYLE + KIT_BAND_STYLE + KIT_METER_STYLE + KIT_ASK_STYLE;
