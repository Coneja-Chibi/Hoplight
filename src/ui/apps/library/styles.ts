/**
 * Library app chrome CSS (injected <style> string). Kept out of index so the app
 * stays under the line cap; views/registry appends deck-view CSS at runtime.
 */

export const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 20h16"/><rect x="5" y="8" width="3" height="12"/><rect x="9.5" y="5" width="3" height="15"/><path d="M15 20V9l3-1 1.6 10.8-3.4.6z"/></svg>';

export const PREF_VIEW = "library.view";
export const PREF_SIZE = "library.size";
export const PREF_FIRST_DECK = "firstDeck"; // written by the setup wizard; the shelves open on it

export const LIBRARY_STYLE = `
.lib{display:flex;flex-direction:column;gap:.7rem;padding:clamp(.7rem,1.8vw,1.1rem);min-height:100%}
.lib .stagezone{flex:1;display:flex;flex-wrap:wrap;gap:var(--gap-l);align-items:center;justify-content:center;padding:var(--gap-l)}
.doorcard{aspect-ratio:2/3;width:clamp(11rem,22vw,16rem);display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:var(--gap-m);background:var(--panel);color:var(--ink);cursor:pointer;padding:var(--gap-m);text-align:center;
  font-family:var(--font-big);font-weight:900;font-size:clamp(1rem,1.6vw,1.3rem);line-height:1.15}
.doorcard.primary{background:var(--rose);color:var(--stage-white)}
.voice{font-style:italic;font-weight:600;color:var(--muted);text-align:center;font-size:1.05rem}
.damage-note{position:relative;border:3px solid var(--rose);box-shadow:4px 4px 0 0 var(--edge);
  background:var(--panel);color:var(--text);padding:.65rem .8rem}
.damage-note strong{display:block;font-family:var(--font-big);font-weight:900;padding-right:5rem}
/* sits in the notice's own corner, clear of the heading it belongs to */
.dnx{position:absolute;top:.55rem;right:.6rem;font-family:var(--font-mono);font-weight:700;
  font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;background:transparent;
  color:var(--text-dim);border:2px solid var(--text-faint);cursor:pointer;padding:.2rem .45rem}
.dnx:hover{color:var(--text);border-color:var(--rose)}
.damage-note p{margin:.35rem 0 0;color:var(--text-dim);font-size:.85rem}
.damage-note details{margin-top:.45rem}
.damage-note summary{cursor:pointer;font-family:var(--font-mono);font-weight:700;font-size:.7rem;
  letter-spacing:.04em;text-transform:uppercase}
.damage-note ul{margin:.55rem 0 0;padding-left:1.35rem}
.damage-note li{margin:.25rem 0;font-size:.8rem}
.damage-note code{overflow-wrap:anywhere}
/* the import sheet (InkDialog owns overlay/sheet chrome; the delsheet/export-dialog grammar) */
.impsheet{padding:1.1rem 1.3rem;width:min(94vw,44rem)}
.impkick{font-family:var(--font-mono);font-weight:700;font-size:.66rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--text-dim);margin:0 0 .3rem}
.imptitle{display:block;font-family:var(--font-big);font-weight:900;font-size:1.15rem;color:var(--text);
  margin:0 0 .3rem}
.impsub{font-family:var(--font-mono);font-size:.66rem;letter-spacing:.04em;color:var(--text-soft);margin:0 0 .9rem}
.improws{display:flex;flex-direction:column;gap:.55rem;max-height:50dvh;overflow:auto;margin:0 0 1rem}
.improw{position:relative;display:flex;gap:.7rem;align-items:flex-start;background:var(--face);
  border:2px solid var(--edge);padding:.65rem .8rem;cursor:pointer}
.improw.on{border-color:var(--accent);box-shadow:2px 2px 0 0 var(--edge)}
.improw.bad{border-style:dashed;cursor:default}
.improw input{position:absolute;opacity:0;width:1px;height:1px}
.impcheck{flex:none;width:1.1rem;height:1.1rem;border:2px solid var(--edge);background:var(--face);
  position:relative;margin-top:.15rem}
.improw input:checked + .impcheck{background:var(--accent-deep);border-color:var(--accent)}
.improw input:checked + .impcheck::after{content:"";position:absolute;left:.28rem;top:.08rem;
  width:.3rem;height:.55rem;border:solid var(--stage-white);border-width:0 2px 2px 0;transform:rotate(45deg)}
.improw input:focus-visible + .impcheck{outline:2px solid var(--accent);outline-offset:2px}
.impbody{min-width:0}
.impname{display:block;font-family:var(--font-big);font-weight:800;font-size:1rem;color:var(--text);
  overflow-wrap:anywhere}
.impkind{font-family:var(--font-body);font-size:.9rem;color:var(--text);margin:.15rem 0 0}
.impmeta{font-family:var(--font-mono);font-size:.66rem;letter-spacing:.04em;color:var(--text-soft);margin:.25rem 0 0}
.impflag{display:inline-block;font-family:var(--font-mono);font-weight:700;font-size:.625rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--rose-deep);color:var(--stage-white);padding:.12rem .4rem;margin:0 0 .25rem}
.imperr{font-family:var(--font-body);font-size:.85rem;color:var(--text-soft);margin:.1rem 0 0;overflow-wrap:anywhere}
/* progress marker (house bar grammar: bordered track, accent fill; the fill is a mark, no text) */
.impbar{display:block;height:.6rem;border:2px solid var(--edge);background:var(--face);
  position:relative;margin:0 0 .5rem}
.impbar i{position:absolute;left:0;top:0;bottom:0;background:var(--accent);transition:width .15s ease}
.impprog{font-family:var(--font-mono);font-size:.66rem;letter-spacing:.04em;color:var(--text-soft);margin:0 0 .9rem}
.improw.dupe{border-style:dotted;cursor:default;opacity:.85}
/* archive report card: informational, never checkable, so it reads on --panel (damage-note's own
   convention for "read this", not --face's "check this") rather than borrowing improw's own look. */
.impreport{background:var(--panel);border:2px solid var(--edge);padding:.65rem .8rem}
.impreport .impname{margin:0 0 .3rem}
.impreport ul{margin:.35rem 0 0;padding-left:1.15rem}
.impreport li{font-family:var(--font-body);font-size:.82rem;color:var(--text-soft);margin:.15rem 0;
  overflow-wrap:anywhere}
.impacts{display:flex;gap:.5rem;flex-wrap:wrap}
.impbtn{font-family:var(--font-big);font-weight:900;font-size:.7rem;letter-spacing:.07em;
  text-transform:uppercase;background:var(--panel);color:var(--text);cursor:pointer;padding:.45rem .8rem}
/* deep fill carries the label (AA law); the BRIGHT picked accent rides the border so the button
   visibly belongs to the user's accent choice instead of reading as an unrelated dark color */
.impbtn.primary{background:var(--accent-deep);color:var(--stage-white);border-color:var(--accent)}
.impbtn:disabled{opacity:.45;cursor:default}
.wbbar{display:flex;align-items:center;gap:.6rem;flex:none;flex-wrap:wrap}
/* the staging action bar: appears only when pieces are picked (the distributed tray's commit) */
.sendbar{display:flex;align-items:center;gap:.6rem;flex:none;flex-wrap:wrap;background:var(--stamp-bg);
  border:3px solid var(--edge);box-shadow:4px 4px 0 0 var(--accent);padding:.4rem .55rem .4rem .7rem}
.sendbar .cnt{font-family:var(--font-big);font-weight:900;font-size:.75rem;letter-spacing:.04em;color:var(--stamp-fg)}
.sendbar .send{font-family:var(--font-big);font-weight:900;font-size:.8125rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--accent-deep);color:var(--stage-white);border:3px solid var(--edge);cursor:pointer;
  padding:.4rem .8rem;box-shadow:3px 3px 0 0 var(--edge);transition:transform .1s ease-out,box-shadow .1s ease-out}
.sendbar .send:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--edge)}
.sendbar .clear{font-family:var(--font-mono);font-weight:700;font-size:.66rem;letter-spacing:.08em;
  text-transform:uppercase;background:transparent;color:var(--stamp-fg);
  border:2px solid color-mix(in srgb,var(--stamp-fg) 45%,transparent);
  cursor:pointer;padding:.35rem .6rem}
.sendbar .clear:hover{border-color:var(--stamp-fg)}
.sendbar .del{font-family:var(--font-big);font-weight:900;font-size:.8125rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--rose-deep);color:var(--stage-white);border:3px solid var(--rose);
  cursor:pointer;padding:.4rem .8rem;transition:transform .1s ease-out,box-shadow .1s ease-out}
.sendbar .del:hover{transform:translate(-1px,-1px);box-shadow:2px 2px 0 0 var(--edge)}
.stage-crumb .crumbsel{font-family:var(--font-mono);font-weight:700;font-size:.625rem;
  letter-spacing:.1em;text-transform:uppercase;background:transparent;color:var(--text-dim);
  border:2px solid var(--text-faint);cursor:pointer;padding:.25rem .5rem}
.stage-crumb .crumbsel:hover{color:var(--text);border-color:var(--edge)}
.delsheet{padding:1rem 1.1rem;max-width:24rem}
.delsheet .deltitle{display:block;font-family:var(--font-big);font-weight:900;font-size:.95rem;
  color:var(--text);margin:0 0 .45rem}
.delsheet .delbody{font-family:var(--font-body);font-size:.8rem;color:var(--text-dim);margin:0 0 .8rem;
  line-height:1.5}
.delsheet .delacts{display:flex;gap:.5rem}
.delsheet .delgo{font-family:var(--font-big);font-weight:900;font-size:.6875rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--rose-deep);color:var(--stage-white);border:3px solid var(--edge);
  cursor:pointer;padding:.45rem .9rem;box-shadow:3px 3px 0 0 var(--edge)}
.delsheet .delno{font-family:var(--font-mono);font-weight:700;font-size:.625rem;letter-spacing:.08em;
  text-transform:uppercase;background:transparent;color:var(--text-dim);border:2px solid var(--text-faint);
  cursor:pointer;padding:.45rem .8rem}
.delsheet .delno:hover{color:var(--text);border-color:var(--edge)}
.delsheet .renamein{width:100%;font-family:var(--font-body);font-size:.95rem;color:var(--text);
  background:var(--face);border:2px solid var(--edge);padding:.45rem .55rem;margin:0 0 .8rem}
.deckchips{display:flex;gap:.4rem;flex:1;min-width:0;overflow-x:auto;padding-bottom:2px}
.dchip{display:flex;align-items:center;gap:.45rem;flex:none;cursor:pointer;font-family:var(--font-big);
  font-weight:800;font-size:.625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim);
  background:var(--face);border:3px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge);padding:.35rem .55rem;
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.dchip .pip{width:10px;height:10px;flex:none;border:2px solid var(--edge);background:var(--a)}
.dchip .dc{font-family:var(--font-mono);font-weight:600;font-size:.5625rem;color:var(--text-dim)}
.dchip:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--edge)}
.dchip.on{background:var(--stamp-bg);color:var(--stamp-fg);box-shadow:3px 3px 0 0 var(--a)}
.dchip.on .dc{color:var(--stamp-fg);opacity:.7}
.viewseg{display:flex;flex:none;border:3px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge)}
.viewseg button{border:none;border-left:3px solid var(--edge);background:var(--face);color:var(--text-dim);
  font-family:var(--font-big);font-weight:800;font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;
  padding:.4rem .6rem;cursor:pointer;display:flex;align-items:center;gap:.35rem}
.viewseg button:first-child{border-left:none}
.viewseg button.on{background:var(--stamp-bg);color:var(--stamp-fg)}
.viewseg svg{display:block}
.sizedial{display:flex;align-items:center;gap:.45rem;flex:none;border:3px solid var(--edge);
  box-shadow:3px 3px 0 0 var(--edge);background:var(--face);padding:.3rem .6rem}
.sizedial .sk{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim)}
.sizedial input{appearance:none;-webkit-appearance:none;width:clamp(5rem,9vw,8rem);height:3px;background:var(--text-faint);
  outline:none;cursor:pointer}
.sizedial input::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:12px;height:12px;
  background:var(--text);border:2px solid var(--edge)}
.sizedial input::-moz-range-thumb{width:12px;height:12px;background:var(--text);border:2px solid var(--edge);border-radius:0}
/* the search box wears the size dial's chrome (bordered, stamped, mono kicker) so the deck bar
   still reads as one object rather than a toolbar with a web form bolted on */
/* NEVER GROWS. The deck chips are this room's navigation and they own the leftover width; a
   search box with flex-grow took it and pushed three of the six decks behind a scroll nobody
   could see. It still shrinks, so a narrow window squeezes the box rather than hiding a deck. */
.findwrap{position:relative;display:flex;flex-direction:column;flex:0 1 18rem;min-width:0}
.findbox{display:flex;align-items:center;gap:.45rem;border:3px solid var(--edge);
  box-shadow:3px 3px 0 0 var(--edge);background:var(--face);padding:.3rem .5rem}
/* a live search stamps in the house accent: the one glance that says the shelf is filtered */
.findwrap.on .findbox{box-shadow:3px 3px 0 0 var(--accent)}
.findbox:focus-within{outline:2px solid var(--accent);outline-offset:2px}
.findbox .sk{flex:none;font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--text-dim)}
.findbox input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--text);
  font-family:var(--font-mono);font-size:.7rem;padding:.15rem 0}
.findbox input::placeholder{color:var(--text-faint)}
.findx{flex:none;font-family:var(--font-mono);font-weight:700;font-size:.5625rem;letter-spacing:.1em;
  text-transform:uppercase;background:transparent;color:var(--text-dim);border:2px solid var(--text-faint);
  cursor:pointer;padding:.15rem .35rem}
.findx:hover{color:var(--text);border-color:var(--edge)}
/* HANGS OFF THE FIELD rather than sitting in the toolbar's flow. In flow it grew the bar by three
   lines the moment a typo appeared, shoving every deck chip down mid-keystroke. */
.findnote{position:absolute;top:calc(100% + .25rem);left:0;right:0;z-index:2;background:var(--panel);
  border:2px solid var(--edge);box-shadow:3px 3px 0 0 var(--edge);padding:.35rem .45rem;margin:0;
  font-family:var(--font-mono);font-size:.6rem;line-height:1.5;color:var(--text-soft);
  overflow-wrap:anywhere}
/* a deck holding no matches RECEDES rather than vanishing: the chip still says what it holds */
.dchip.nil{opacity:.45}
/* the filtered-to-nothing shelf, deliberately NOT the ghost card. The ghost invites a first
   import, which is the wrong answer (and a small lie) when the pieces are already here and merely
   hidden by what somebody typed. */
.nomatch{margin:auto;max-width:32rem;display:flex;flex-direction:column;align-items:flex-start;
  gap:.55rem;border:2px dashed var(--stage-line);padding:1rem 1.1rem}
.nomatch .nmhead{font-family:var(--font-big);font-weight:900;font-size:.9rem;letter-spacing:.04em;
  text-transform:uppercase;color:var(--stage-card)}
.nomatch .nmbody{font-family:var(--font-body);font-size:.95rem;line-height:1.5;color:var(--stage-soft);margin:0}
.nomatch .nmq{font-family:var(--font-mono);font-size:.8rem;color:var(--stage-paper);
  background:var(--stage-sunken);border:2px solid var(--stage-seam);padding:.05rem .3rem;overflow-wrap:anywhere}
.nomatch .nmjumps{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}
.nomatch .nmk{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--stage-kicker)}
.nomatch .nmjump{font-family:var(--font-big);font-weight:800;font-size:.625rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--stage-panel);color:var(--stage-soft);
  border:2px solid var(--stage-seam);cursor:pointer;padding:.3rem .5rem}
.nomatch .nmjump:hover{color:var(--stage-card);border-color:var(--stage-line)}
.nomatch .nmclear{font-family:var(--font-mono);font-weight:700;font-size:.625rem;letter-spacing:.1em;
  text-transform:uppercase;background:transparent;color:var(--stage-mute);border:2px solid var(--stage-faint);
  cursor:pointer;padding:.3rem .55rem}
.nomatch .nmclear:hover{color:var(--stage-paper);border-color:var(--stage-line)}
/* THE PERSON'S OWN GROUPINGS. Quieter than the deck chips on purpose: decks are the studio's own
   shape and are always true, while a group is a private note about some of it. Same chip grammar so
   the row still reads as one toolbar, one weight down. */
.colbar{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;flex:none;min-width:0}
.colbar>.sk{flex:none;font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--text-dim)}
.colchip{display:flex;align-items:stretch;flex:none;border:2px solid var(--edge);background:var(--face)}
.colchip.on{box-shadow:2px 2px 0 0 var(--accent)}
.colchip button{border:none;background:transparent;cursor:pointer;font-family:var(--font-big);
  font-weight:800;font-size:.5625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim);
  padding:.3rem .45rem}
.colname{display:flex;align-items:center;gap:.35rem}
.colchip.on .colname{background:var(--stamp-bg);color:var(--stamp-fg)}
.colcount{font-family:var(--font-mono);font-weight:600;font-size:.5rem;opacity:.75}
/* the two verbs only ever act on the chip they sit in, so they stay inside its border */
.coladd,.coldel{border-left:2px solid var(--edge)!important;color:var(--text-faint)}
.coladd:hover{color:var(--accent)}
.coldel:hover{color:var(--text)}
.colmake{flex:none;font-family:var(--font-big);font-weight:800;font-size:.5625rem;letter-spacing:.08em;
  text-transform:uppercase;background:transparent;color:var(--text-dim);border:2px dashed var(--text-faint);
  cursor:pointer;padding:.3rem .5rem}
.colmake:hover{color:var(--text);border-color:var(--edge);border-style:solid}
.colnew{flex:none;width:9rem;border:2px solid var(--accent);background:var(--face);color:var(--text);
  font-family:var(--font-mono);font-size:.7rem;padding:.25rem .4rem;outline:none}
/* the bar says what happened, because the mono status bar cannot: see collections-ops.ts on say */
.colnote{display:flex;align-items:center;gap:.4rem;flex:none;font-family:var(--font-mono);
  font-size:.625rem;color:var(--text-soft);border:2px solid var(--text-faint);padding:.25rem .45rem}
.colnote button{border:none;background:transparent;cursor:pointer;font-family:var(--font-mono);
  font-weight:700;font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim)}
.colnote button:hover{color:var(--text)}
.prosc{position:relative;flex:1;min-height:0;background:var(--shell-panel-2);border:3px solid var(--edge);
  box-shadow:6px 6px 0 0 var(--edge);padding:.55rem;display:flex}
.libstage{position:relative;flex:1;min-height:0;background:var(--stage-well);border:3px solid var(--stage-black);overflow:hidden;
  box-shadow:inset 8px 8px 0 0 var(--shadow-ink-deep);display:flex;flex-direction:column}
.stage-crumb{display:flex;align-items:center;gap:.5rem;border-bottom:3px solid var(--stage-black);background:var(--stage-sunken);padding:.5rem .75rem;flex:none}
.stage-crumb .pip{width:11px;height:11px;border:2px solid var(--stage-black);background:var(--a)}
.stage-crumb .cn{font-family:var(--font-big);font-weight:900;font-size:.6875rem;letter-spacing:.06em;text-transform:uppercase;color:var(--stage-paper)}
.stage-crumb .cc{font-family:var(--font-mono);font-size:.5625rem;letter-spacing:.1em;text-transform:uppercase;color:var(--stage-mute);margin-left:auto}
.ghost-shelf{margin:auto;width:clamp(9rem,30vw,14rem);aspect-ratio:2/3;border:2px dashed var(--stage-faint);
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:.8rem;
  font-family:var(--font-mono);font-size:.7rem;font-weight:600;letter-spacing:.06em;line-height:1.6;
  text-transform:uppercase;color:var(--stage-soft)}
/* the ghost shelf's create button: the send stamp, which only .sendbar styled before (it rendered
   as a naked browser button out here) */
.ghost-shelf .send{font-family:var(--font-big);font-weight:900;font-size:.6875rem;letter-spacing:.08em;
  text-transform:uppercase;background:var(--rose);color:var(--stage-white);border:3px solid var(--stage-black);
  cursor:pointer;padding:.45rem .85rem;box-shadow:3px 3px 0 0 var(--stage-black);
  transition:transform .1s ease-out,box-shadow .1s ease-out}
.ghost-shelf .send:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 0 var(--stage-black)}
/* scrollbars wear the house ink, never the OS chrome */
.lib *{scrollbar-width:thin;scrollbar-color:var(--stage-seam) transparent}
.lib *::-webkit-scrollbar{width:8px;height:8px}
.lib *::-webkit-scrollbar-thumb{background:var(--stage-seam)}
.lib *::-webkit-scrollbar-track{background:transparent}
.deckchips{scrollbar-width:none}
.deckchips::-webkit-scrollbar{display:none}
/* phones: chips WRAP (everything visible, nothing hidden behind an invisible scroll), the view
   seg gets its row, the dial gets a full row so the thumb never clips (fluid law) */
@media(max-width:40rem){
  .lib{padding:.5rem;gap:.5rem}
  .wbbar{gap:.4rem}
  .findwrap{order:0;flex:1 1 100%}
  .deckchips{flex:1 1 100%;order:1;flex-wrap:wrap;overflow:visible;padding-bottom:0}
  .viewseg{order:2}
  .sizedial{order:3;flex:1 1 100%;min-width:0}
  .sizedial input{flex:1;width:auto;min-width:0}
  .prosc{padding:.3rem;box-shadow:4px 4px 0 0 var(--edge)}
  .lib .stagezone{gap:var(--gap-m);padding:var(--gap-m)}
  .doorcard{width:clamp(9rem,42vw,12rem)}
}
`;
