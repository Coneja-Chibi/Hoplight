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
  .deckchips{flex:1 1 100%;order:1;flex-wrap:wrap;overflow:visible;padding-bottom:0}
  .viewseg{order:2}
  .sizedial{order:3;flex:1 1 100%;min-width:0}
  .sizedial input{flex:1;width:auto;min-width:0}
  .prosc{padding:.3rem;box-shadow:4px 4px 0 0 var(--edge)}
  .lib .stagezone{gap:var(--gap-m);padding:var(--gap-m)}
  .doorcard{width:clamp(9rem,42vw,12rem)}
}
`;
