/**
 * Deck view: CAROUSEL - the floated deck (the signature cardpack interaction, vs-deck-string
 * lineage). Perspective arc, center forward; best for small decks and showing off. Kept as ONE
 * option after Chi's 2026-07-05 review: grids scale, the carousel charms.
 */
import { deckMeta } from "../../../_shared/decks";
import { floatPlan } from "../bench-core";
import { h, pieceKey, type DeckView } from "../view-contract";

const CSS = `
.dv-float{flex:1;min-height:0;display:flex;align-items:center;gap:clamp(.6rem,1.6vw,1.15rem);
  padding:clamp(.9rem,2vw,1.4rem) clamp(.7rem,1.8vw,1.2rem);overflow-x:auto;perspective:1400px}
.dv-fcard{flex:none;width:var(--card-w);background:#17161d;border:3px solid #000;cursor:pointer;
  text-align:left;font:inherit;padding:0;
  transform:rotateY(calc(var(--tilt,0) * 1deg)) translateY(calc(var(--rise,0) * 1px));
  box-shadow:0 20px 30px -12px rgba(0,0,0,.78);transition:transform .18s ease-out,box-shadow .18s ease-out}
.dv-fcard:hover{transform:translateY(-8px) rotateY(0deg);box-shadow:0 30px 44px -14px rgba(0,0,0,.85)}
.dv-fcard.cast{opacity:.26}
.dv-fcard .cov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid #000;position:relative;
  display:flex;align-items:flex-end;padding:.4rem;background-size:cover;background-position:center top}
.dv-fcard .cov b{font-family:var(--font-big);font-weight:900;font-size:clamp(1.6rem,5vw,2.4rem);line-height:.7;color:#0a0a0c;opacity:.82}
.dv-fcard .cov .kd{position:absolute;top:0;left:0;background:#0a0a0c;color:var(--a);font-family:var(--font-mono);
  font-size:.44rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;padding:2px 5px;border-right:3px solid #000;border-bottom:3px solid #000}
.dv-fcard .bd{padding:.4rem .5rem .5rem}
.dv-fcard .n{font-family:var(--font-big);font-weight:800;font-size:.75rem;color:#f4f1ee;line-height:1}
`;

const view: DeckView = {
  id: "carousel",
  label: "Deck",
  iconSvg:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="4" width="8" height="14"/><path d="M5 6v12M19 6v12"/></svg>',
  order: 20,
  css: CSS,
  render(ctx) {
    const float = h("div", "dv-float");
    const plan = floatPlan(ctx.entities.length);
    ctx.entities.forEach((e, i) => {
      const onBench = ctx.threaded.has(pieceKey(e));
      const card = h("button", `dv-fcard${onBench ? " cast" : ""}`);
      card.style.setProperty("--a", e.accent ?? deckMeta(e.kind).accent);
      card.style.setProperty("--card-w", ctx.size.cardW);
      card.style.setProperty("--tilt", String(plan[i]!.tilt));
      card.style.setProperty("--rise", String(plan[i]!.rise));
      const cov = h("div", "cov");
      const art = ctx.portraitUrl(e);
      if (art) cov.style.backgroundImage = `url("${art}")`;
      else cov.append(h("b", undefined, e.name.charAt(0).toUpperCase()));
      cov.append(h("span", "kd", e.kind));
      const bd = h("div", "bd");
      bd.append(h("div", "n", e.name));
      card.append(cov, bd);
      card.title = onBench ? `Pull ${e.name} off the bench` : `Thread ${e.name} onto the bench`;
      card.addEventListener("click", () => ctx.onPiece(e));
      float.append(card);
    });
    return float;
  },
};

export default view;
