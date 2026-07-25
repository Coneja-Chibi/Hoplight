/** @jsxImportSource @opentui/react */
/** Byte-for-byte terminal previewer: render the real App, read the captured colored cells, and emit an
 *  HTML grid that reproduces the terminal output exactly (real chars + real fg/bg). Screenshot that. */
import { writeFileSync } from "node:fs";
import { testRender } from "@opentui/react/test-utils";
import { App } from "./src/kit/render/app";

const W = Number(process.env.W ?? 120);
const H = Number(process.env.H ?? 38);
const session = {
  runTurn: async (_i: string, h: unknown[]) => h,
  probe: async () => {},
  activeProvider: async () => ({ name: "NanoGPT", model: "zai-org/glm-5.2:thinking" }),
} as never;

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, " ");
const rgb = (c: { toInts(): [number, number, number, number] }): string => {
  const [r, g, b] = c.toInts();
  return `rgb(${r},${g},${b})`;
};

const t = await testRender(<App studioName="Hoplight Studio" totalPieces={16} decks={[]} session={session} onQuit={() => {}} />, {
  width: W,
  height: H,
});
await new Promise((r) => setTimeout(r, 300));
const frame = t.captureSpans();

let body = "";
for (const line of frame.lines) {
  body += `<div class="r">`;
  for (const span of line.spans) {
    const bold = span.attributes & 1 ? "font-weight:700;" : "";
    body += `<span style="color:${rgb(span.fg)};background:${rgb(span.bg)};${bold}">${esc(span.text)}</span>`;
  }
  body += `</div>`;
}
const html = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#000;padding:10px;display:inline-block}
  .term{font-family:"Cascadia Mono","JetBrains Mono",Consolas,monospace;font-size:17px;line-height:19px;white-space:pre;background:#08080a}
  .r{height:19px}
</style><div class="term">${body}</div>`;
writeFileSync("wireframes/_tui-capture.html", html);
console.log(`wrote wireframes/_tui-capture.html (${frame.cols}x${frame.rows})`);
await t.renderer.destroy();
process.exit(0);
