/**
 * Universal target pack: generic card/page pieces. Works anywhere CSS is a string.
 */
import type { CssTargetPack } from "./contract";

const pack: CssTargetPack = {
  id: "universal",
  order: 10,
  title: "Universal",
  blurb: "Generic card pieces. Plain CSS, any host.",
  mockHtml: `
<div class="page">
  <article class="card">
    <header class="card-header">
      <div class="avatar" aria-hidden="true"></div>
      <div class="card-meta">
        <h1 class="name">Sample Name</h1>
        <p class="subtitle">subtitle / creator</p>
      </div>
    </header>
    <p class="body">Body text. Style me with the knobs or write CSS below.</p>
    <footer class="card-footer"><span class="tag">tag</span><span class="tag">tag</span></footer>
  </article>
</div>`.trim(),
  targets: [
    { id: "page", label: "Page", selector: ".page", help: "Outer page shell" },
    { id: "card", label: "Card", selector: ".card", help: "Main card surface" },
    { id: "header", label: "Header", selector: ".card-header" },
    { id: "avatar", label: "Avatar", selector: ".avatar" },
    { id: "name", label: "Name", selector: ".name" },
    { id: "body", label: "Body text", selector: ".body" },
    { id: "tag", label: "Tags", selector: ".tag" },
    { id: "free", label: "Free selector", selector: "", help: "Type any selector in Assist" },
  ],
};

export default pack;
