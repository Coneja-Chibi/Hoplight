/**
 * The agent window, in Kit's own visual language.
 *
 * A TRANSLATION, NOT AN IMITATION. Every colour here is `var(--kit-*)`, emitted from
 * src/kit/render/theme.ts at runtime by kit-vars.ts, so there is exactly one palette and this
 * surface cannot drift from the terminal. What is translated is the GRAMMAR, which is the part that
 * carries meaning:
 *
 * THE CONVERSATION IS A STACK OF SHADED BANDS. Kit's transcript does not separate turns with rules -
 * per-line dividers "chopped a single turn into disjointed megablocks" and were taken out. Tonal
 * contrast does the work instead: your line LIFTS (`lift`, clearly raised), a reply RECESSES
 * (`recess`, near-black), a tool call sits on `row`. Nothing here draws a horizontal rule between
 * messages, deliberately.
 *
 * EVERY BAND HAS A LEFT SPINE, and the spine's colour is what the band IS: rose for your turn,
 * teal-deep for a tool, gold for a notice, rose for the Gate. A tool's spine takes its VERB colour -
 * cool for reads, warm for writes, red for destructive - so risk reads at a glance before any of the
 * words do.
 *
 * TEXT FLOORS AT `quiet`. Kit's palette is explicit that `mut` and `line` are BORDERS ONLY and never
 * text, so nothing here reads as dim grey. Body prose sits at `soft`, the legible floor.
 *
 * THE COMPOSER IS A STAMP: a heavy `line` frame with the rose prompt block fused to its left edge,
 * which is Kit's input bar exactly - "a real stamp, not a floating marker".
 */

/** Namespaced by app id, the rule every other preference in this repo follows. */
export const PREF_BAND_FOLDED = "agent.bandFolded";
/** The floating panel, shrunk to a tab you click to bring it back. */
export const PREF_PANEL_MINIMISED = "agent.panelMinimised";

export const AGENT_STYLE = `
.agent-room{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--kit-well);
  color:var(--kit-text);font-family:var(--font-mono)}

/* The header: panel ground, a seam beneath, nothing shouting. */
.agent-room__head{background:var(--kit-panel);border-bottom:1px solid var(--kit-seam);
  padding:.55rem .7rem;flex:none}
.agent-room__kick{display:flex;align-items:center;gap:.4rem;margin:0;font-size:.62rem;
  letter-spacing:.1em;text-transform:uppercase;color:var(--kit-soft);flex-wrap:wrap}
/* The alive dot from Kit's status bar: filled green when it can answer, hollow when it cannot. */
.agent-room__dot{width:.5rem;height:.5rem;border-radius:50%;flex:none;background:transparent;
  box-shadow:inset 0 0 0 1px var(--kit-mut)}
.agent-room__dot--live{background:var(--kit-alive);box-shadow:none}
.agent-room__head h1{margin:.25rem 0 0;font-family:var(--font-big);font-weight:900;
  font-size:1.15rem;line-height:1.1;color:var(--kit-text)}
.agent-room__sub{margin:.15rem 0 0;font-style:italic;color:var(--kit-soft);font-size:.8rem}

.agent-room__notice{margin:0;background:var(--kit-recess);border-left:2px solid var(--kit-gold);
  color:var(--kit-soft);padding:.5rem .7rem;font-size:.78rem;line-height:1.5;flex:none}

/* ---------- the transcript: shaded bands, spines, no rules between turns ---------- */
/*
 * THE TRANSCRIPT TAKES THE SLACK. It must not also carry .agent-room__block, which sets flex:none
 * and is declared later at the same specificity - so it silently won, the transcript could not
 * grow, and the whole conversation bunched at the top of the panel with the height falling off the
 * bottom unused. Two single-class rules setting the same property on one element is the trap.
 */
.agent-room__talk{display:flex;flex-direction:column;gap:.25rem;flex:1;min-height:0;
  overflow:auto;background:var(--kit-well);padding:.4rem 0}

.agent-room__line{display:flex;flex-direction:column;gap:.1rem;padding:.4rem .7rem;
  border-left:2px solid transparent}
/* YOUR TURN LIFTS. Kit's rule: your line is clearly raised, the reply sits back. */
.agent-room__line--user{background:var(--kit-lift);border-left-color:var(--kit-rose)}
.agent-room__line--assistant{background:var(--kit-recess);border-left-color:var(--kit-seam)}
.agent-room__line--tool{background:var(--kit-row);border-left-color:var(--kit-teal-deep)}

.agent-room__who{font-size:.56rem;letter-spacing:.18em;text-transform:uppercase;
  color:var(--kit-quiet)}
.agent-room__line--user .agent-room__who{color:var(--kit-rose)}
/*
  A LINE'S PROSE IS STYLED BY ITS OWN CLASS, not by a descendant element selector. The rule here
  used to be ".agent-room__line p", which was fine while a line was one paragraph and became a bug
  the moment the agent's words started rendering as markdown: a descendant selector outranks a
  single class, so it silently overrode every heading, list item and quote the renderer produced.
  The prose rules live beside the renderer now, in agent/kit-transcript-style.ts.
*/

/* Tucked under the turn, compact, never a full-width block of its own. */
.agent-room__empty{margin:0;padding:.35rem .7rem .35rem 1.4rem;color:var(--kit-quiet);
  font-style:italic;font-size:.78rem}

/* The brief: a recessed code slab on Kit's sunken field fill. */
.agent-room__block{display:flex;flex-direction:column;gap:.3rem;padding:.4rem .7rem;flex:none}
.agent-room__block summary{font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;
  color:var(--kit-quiet);cursor:pointer}
.agent-room__brief{margin:.3rem 0 0;background:var(--kit-sunken);border:1px solid var(--kit-line);
  padding:.55rem .7rem;font-family:var(--font-mono);font-size:.72rem;line-height:1.5;
  color:var(--kit-soft);white-space:pre-wrap;overflow-wrap:anywhere;max-height:22rem;overflow:auto}
`;

/** The composer: Kit's input bar, stamped rather than floating. */
export const AGENT_TALK_STYLE = `
/* Attached pictures, above the composer. Clicking one removes it, so the whole tile is the button. */
.agent-room__shots{display:flex;gap:.4rem;flex-wrap:wrap;padding:.4rem .5rem 0}
.agent-room__shots button{position:relative;padding:0;border:1px solid var(--kit-line);background:none;cursor:pointer;line-height:0}
.agent-room__shots img{width:3rem;height:3rem;object-fit:cover;display:block}
.agent-room__shots button:hover{border-color:var(--kit-bad)}
.agent-room__composer{position:relative;display:flex;align-items:stretch;gap:0;background:var(--kit-well);
  border-top:1px solid var(--kit-seam);padding:.5rem .7rem;flex:none}
/* The rose prompt block, fused to the field's left border. Kit: "a real stamp, not a marker". */
.agent-room__composer::before{content:">";display:flex;align-items:center;
  background:var(--kit-rose-deep);color:var(--kit-white);font-family:var(--font-mono);
  font-weight:700;font-size:.85rem;padding:0 .5rem;border:1px solid var(--kit-line);border-right:0}
.agent-room__composer textarea{flex:1;resize:none;min-height:2.2rem;max-height:9rem;
  background:var(--kit-panel);border:1px solid var(--kit-line);color:var(--kit-text);
  padding:.4rem .55rem;font-family:var(--font-body);font-size:.83rem;line-height:1.5}
.agent-room__composer textarea::placeholder{color:var(--kit-quiet)}
.agent-room__composer textarea:focus{outline:none;border-color:var(--kit-rose)}
.agent-room__composer textarea:disabled{color:var(--kit-quiet);cursor:not-allowed}
.agent-room__composer button{flex:none;border:1px solid var(--kit-line);border-left:0;
  background:var(--kit-panel);color:var(--kit-text);font-family:var(--font-mono);font-weight:700;
  font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;padding:0 .8rem;cursor:pointer}
.agent-room__composer button:hover:not(:disabled){background:var(--kit-lift)}
.agent-room__composer button:disabled{color:var(--kit-quiet);cursor:not-allowed}
/* Stopping is the rose act while a turn runs, the way "working" turns rose in Kit's status bar. */
.agent-room__stop{flex:none;border:1px solid var(--kit-line);border-left:0;
  background:var(--kit-rose-deep);color:var(--kit-white);font-family:var(--font-mono);
  font-weight:700;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;
  padding:0 .8rem;cursor:pointer}
`;

/** The offered actions, drawn as Kit's key hints rather than as buttons. */
export const AGENT_CHIP_STYLE = `
/* the band fold: a hairline key in the corner, never competing with the conversation */
.agent-room__fold{position:absolute;top:.15rem;right:.35rem;z-index:2;background:transparent;
  border:none;cursor:pointer;color:var(--kit-quiet);font-size:.7rem;line-height:1;padding:.15rem .3rem}
.agent-room__fold:hover{color:var(--kit-text)}
/* queued messages: waiting, and visibly so. A send that sat silent would read as one that failed. */
.agent-room__queue{list-style:none;margin:0;padding:.25rem .7rem;display:flex;flex-direction:column;gap:.25rem;flex:none}
.agent-room__queue li{display:flex;align-items:center;gap:.4rem;min-width:0;
  border-left:2px solid var(--kit-verb-ask);padding-left:.45rem}
.agent-room__queuekick{font-family:var(--kit-mono);font-size:.5rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--kit-quiet);flex:none}
.agent-room__queuetext{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-size:.75rem;color:var(--kit-soft)}
.agent-room__queue button{flex:none;background:transparent;border:1px solid var(--kit-line);
  color:var(--kit-quiet);cursor:pointer;font-family:var(--kit-mono);font-size:.5rem;
  letter-spacing:.1em;text-transform:uppercase;padding:.15rem .35rem}
.agent-room__queue button:hover{color:var(--kit-text);border-color:var(--kit-mut)}
.agent-room__chips{display:flex;flex-wrap:wrap;gap:.3rem;padding:.3rem .7rem;flex:none}
.agent-room__chips button{background:var(--kit-stamp);border:1px solid var(--kit-line);
  color:var(--kit-soft);font-family:var(--font-mono);font-size:.62rem;letter-spacing:.1em;
  text-transform:uppercase;padding:.25rem .55rem;cursor:pointer}
.agent-room__chips button:hover:not(:disabled){background:var(--kit-lift);color:var(--kit-text)}
.agent-room__chips button:disabled{color:var(--kit-quiet);cursor:not-allowed}
`;

/**
 * The Gate: Kit's review card. Panel ground, a rose frame, and the verb colours Kit assigns to the
 * answers, so the two surfaces agree about what a colour means.
 */
export const AGENT_GATE_STYLE = `
.gate-card{display:flex;flex-direction:column;gap:.4rem;margin:.4rem .7rem;flex:none;
  background:var(--kit-panel);border:1px solid var(--kit-rose);
  border-left:3px solid var(--kit-rose);padding:.6rem .7rem}
.gate-card__kick{margin:0;font-family:var(--font-mono);font-size:.58rem;letter-spacing:.18em;
  text-transform:uppercase;color:var(--kit-rose)}
.gate-card__title{font-family:var(--font-big);font-weight:900;font-size:.95rem;
  color:var(--kit-bright)}
.gate-card__why{margin:0;font-size:.78rem;color:var(--kit-soft)}
/* The warnings carry gold: they are the reason to say no, and Kit never mutes what it confides. */
.gate-card__warnings{margin:0;padding-left:1rem;display:flex;flex-direction:column;gap:.15rem}
.gate-card__warnings li{font-size:.78rem;color:var(--kit-gold)}
.gate-card__detail{margin:0;background:var(--kit-sunken);border:1px solid var(--kit-line);
  padding:.5rem .6rem;font-family:var(--font-mono);font-size:.7rem;line-height:1.5;
  color:var(--kit-soft);white-space:pre-wrap;overflow-wrap:anywhere;max-height:16rem;overflow:auto}
.gate-card__row{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.15rem}
.gate-card__row button{background:var(--kit-floor);border:1px solid var(--kit-line);
  color:var(--kit-soft);font-family:var(--font-mono);font-weight:700;font-size:.64rem;
  letter-spacing:.08em;text-transform:uppercase;padding:.28rem .6rem;cursor:pointer}
.gate-card__row button:hover:not(:disabled){background:var(--kit-lift);color:var(--kit-text)}
.gate-card__row button:disabled{color:var(--kit-quiet);cursor:not-allowed}
.gate-card__yes{color:var(--kit-teal);border-color:var(--kit-teal-deep)}
.gate-card__abort{margin-left:auto;color:var(--kit-red);border-color:var(--kit-rose-deep)}
`;

/**
 * Kit's live widgets: the stagehand, the rehearsal, the searchlight, the watcher.
 *
 * The timings match src/kit/render/primitives exactly. Where a terminal steps a value per cell on a
 * timer, this uses a CSS animation of the same duration - the shape is Kit's, the mechanism is the
 * one a browser is good at. Motion is dropped entirely under prefers-reduced-motion; every widget
 * still says what it says without moving.
 */
export const AGENT_KIT_STYLE = `
/* The elapsed clock: a small deep-rose stamp with white digits, everywhere Kit uses one. */
.kit-stamp{background:var(--kit-rose-deep);color:var(--kit-white);font-family:var(--font-mono);
  font-size:.62rem;padding:0 .35rem;letter-spacing:.04em;flex:none}

/* The stagehand. Hushed: it sits in the transcript rather than on top of it. */
.kit-stagehand{display:flex;align-items:center;gap:.4rem;padding:.35rem .7rem .35rem 1.4rem;
  font-family:var(--font-mono);font-size:.72rem;color:var(--kit-mut)}
.kit-stagehand__dot{font-size:.9rem;line-height:1}
.kit-stagehand__verb{color:var(--kit-quiet)}

/* The open rehearsal: a dim seam-bordered box, never sharing the stage with the stagehand. */
.kit-rehearsal{margin:.25rem .7rem;background:var(--kit-recess);border:1px solid var(--kit-seam);
  border-left:2px solid var(--kit-rose-deep)}
.kit-rehearsal__head{display:flex;align-items:center;justify-content:space-between;
  padding:.2rem .4rem;font-family:var(--font-mono);font-size:.56rem;letter-spacing:.2em;
  color:var(--kit-mut)}
.kit-rehearsal__text{margin:0;padding:.35rem .5rem .45rem;font-family:var(--font-mono);
  font-size:.7rem;line-height:1.5;color:var(--kit-quiet);white-space:pre-wrap;
  overflow-wrap:anywhere;max-height:9rem;overflow:hidden}

/* The landed trace: one indented line, not a megablock. */
.kit-trace{padding:.15rem .7rem .15rem 1.4rem}
.kit-trace__line{background:none;border:0;padding:0;cursor:pointer;font-family:var(--font-mono);
  font-size:.68rem;color:var(--kit-mut);text-align:left}
.kit-trace__line:hover{color:var(--kit-quiet)}
.kit-trace__full{margin:.3rem 0 0;font-family:var(--font-mono);font-size:.7rem;line-height:1.5;
  color:var(--kit-quiet);white-space:pre-wrap;overflow-wrap:anywhere}

/* The watcher: a framed aside in gold, because it is the one line that is nobody talking. */
.kit-watch{margin:.25rem .7rem;background:var(--kit-floor);border:1px solid var(--kit-seam);
  border-left:2px solid var(--kit-gold)}
.kit-watch__head{padding:.2rem .4rem;font-family:var(--font-mono);font-size:.56rem;
  letter-spacing:.2em;color:var(--kit-mut)}
.kit-watch__text{margin:0;padding:0 .5rem .35rem;font-size:.75rem;color:var(--kit-soft)}

/* The searchlight, flush on the composer's top edge so the two read as one unit. */
.kit-sweep{position:absolute;top:-1px;left:0;right:0;height:1px;overflow:hidden;pointer-events:none}
.kit-sweep::before{content:"";position:absolute;top:0;bottom:0;width:34%;
  background:linear-gradient(90deg,transparent,var(--kit-rose-deep),var(--kit-rose),
    var(--kit-rose-deep),transparent);
  animation:kit-sweep 11400ms linear infinite}
@keyframes kit-sweep{from{transform:translateX(-100%)}to{transform:translateX(394%)}}

.kit-hints{display:flex;flex-wrap:wrap;gap:.5rem;padding:.2rem .7rem;font-family:var(--font-mono);
  font-size:.62rem}
.kit-hints__pair{display:inline-flex;gap:.25rem;align-items:baseline}
.kit-hints__key{color:var(--kit-bright)}
.kit-hints__label{color:var(--kit-mut)}

@media (prefers-reduced-motion: reduce){
  /* The beam holds still and the dot stops breathing; both still say what they say. */
  .kit-sweep__rule{animation:none;background:none;color:var(--kit-rose-deep)}
}
`;
