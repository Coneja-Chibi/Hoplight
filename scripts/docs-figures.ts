/**
 * Render the docs figure specs (docs/figures/*.js) to static SVGs, so the @fig figures become real
 * assets the in-app Docs room and any markdown viewer can show. Each figure is a self-contained card
 * (its own light background + ink text + palette accents) so it reads on a light or dark page alike.
 * Kinds: flow, matrix, tree, funnel (the only kinds the corpus uses). Tolerant of both export styles
 * (`export default` and `export const figures`) and both nestings (by-slug or flat).
 *
 * Run:   bun run scripts/docs-figures.ts
 * Check: bun run scripts/docs-figures.ts --check   (fail if committed SVGs/manifest differ)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dir, "..");
const FIG_DIR = join(ROOT, "docs", "figures");
const OUT_DIR = join(ROOT, "docs", "generated", "figures");
const MANIFEST = join(ROOT, "docs", "generated", "figures.json");
const checkOnly = process.argv.includes("--check");

const PAL: Record<string, string> = {
  clay: "#C75D52", ochre: "#CC9A47", plum: "#8A6BA8", rose: "#C07594", sage: "#5C9472", teal: "#4E8C9E",
};
const INK = "#1a1712", PAPER = "#faf8f3", CARD = "#ffffff", HAIR = "#e6e0d4", MUTE = "#8a8270";
const KIND: Record<string, string> = {
  root: INK, group: PAL.teal!, shape: PAL.plum!, field: PAL.ochre!, leaf: PAL.ochre!, optional: PAL.sage!,
};
const tone = (c: string | undefined): string => (c && PAL[c]) || c || MUTE;
const esc = (s: unknown): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Greedy word-wrap to a character budget; returns at most `maxLines` lines, last one ellipsised. */
function wrap(s: string, chars: number, maxLines = 3): string[] {
  const words = String(s ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > chars) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    } else cur = cur ? cur + " " + w : w;
  }
  const rest = words.slice(lines.join(" ").split(/\s+/).filter(Boolean).length).join(" ");
  cur = lines.length === maxLines - 1 ? rest : cur;
  if (cur) {
    if (cur.length > chars) cur = cur.slice(0, chars - 1) + "…";
    lines.push(cur);
  }
  return lines.length ? lines : [""];
}

const txt = (x: number, y: number, s: string, cls: string): string =>
  `<text x="${x}" y="${y}" class="${cls}">${esc(s)}</text>`;
const lines = (x: number, y: number, arr: string[], cls: string, lh: number): string =>
  arr.map((l, i) => txt(x, y + i * lh, l, cls)).join("");

const CSS =
  `text{font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;fill:${INK}}` +
  `.h{font-size:13px;font-weight:700;letter-spacing:.02em}.n{font-size:11px;font-weight:700;fill:${MUTE};letter-spacing:.08em}` +
  `.l{font-size:12.5px;font-weight:650}.s{font-size:11px;fill:${MUTE}}.c{font-size:11px;fill:${MUTE}}` +
  `.th{font-size:11px;font-weight:700;fill:${MUTE};letter-spacing:.04em}`;

interface Spec {
  type: string; fig?: string; title?: string; caption?: string;
  steps?: Array<{ label: string; sub?: string; value?: number; color?: string }>;
  cols?: string[]; rows?: Array<{ label: string; cells: string[] }>;
  root?: TreeNode;
}
interface TreeNode { label: string; kind?: string; sum?: string; children?: TreeNode[] }

function frame(w: number, h: number, fig: string, title: string, body: string): string {
  const header =
    txt(20, 30, (fig || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim(), "n") +
    txt(20 + 52, 30, title || "", "h");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">` +
    `<style>${CSS}</style>` +
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="10" fill="${PAPER}" stroke="${HAIR}"/>` +
    `<line x1="20" y1="42" x2="${w - 20}" y2="42" stroke="${HAIR}"/>` +
    header + body + `</svg>`
  );
}

function renderFlow(s: Spec): { w: number; h: number; svg: string } {
  const steps = s.steps ?? [];
  const bw = 158, bh = 92, gap = 30, top = 60, padX = 20;
  const w = padX * 2 + steps.length * bw + (steps.length - 1) * gap;
  const h = top + bh + 20;
  let body = "";
  steps.forEach((st, i) => {
    const x = padX + i * (bw + gap);
    body +=
      `<rect x="${x}" y="${top}" width="${bw}" height="${bh}" rx="7" fill="${CARD}" stroke="${HAIR}"/>` +
      `<rect x="${x}" y="${top}" width="${bw}" height="5" rx="2.5" fill="${tone(st.color)}"/>` +
      lines(x + 12, top + 26, wrap(st.label, 20, 2), "l", 15) +
      lines(x + 12, top + 62, wrap(st.sub ?? "", 24, 3), "s", 13.5);
    if (i < steps.length - 1)
      body += `<path d="M ${x + bw + 8} ${top + bh / 2} l ${gap - 16} 0 m -6 -5 l 6 5 l -6 5" stroke="${MUTE}" fill="none" stroke-width="1.5"/>`;
  });
  return { w, h, svg: frame(w, h, s.fig ?? "", s.title ?? "", body) };
}

function renderFunnel(s: Spec): { w: number; h: number; svg: string } {
  const steps = s.steps ?? [];
  const labW = 250, trackW = 300, rowH = 40, top = 58, padX = 20;
  const max = Math.max(1, ...steps.map((st) => st.value ?? 0));
  const w = padX * 2 + labW + trackW;
  const h = top + steps.length * rowH + 16;
  let body = "";
  steps.forEach((st, i) => {
    const y = top + i * rowH;
    const bw = Math.max(8, ((st.value ?? 0) / max) * trackW);
    body +=
      lines(padX, y + 18, wrap(st.label, 40, 2), "l", 14) +
      `<rect x="${padX + labW}" y="${y + 6}" width="${trackW}" height="22" rx="4" fill="${CARD}" stroke="${HAIR}"/>` +
      `<rect x="${padX + labW}" y="${y + 6}" width="${bw.toFixed(1)}" height="22" rx="4" fill="${tone(st.color)}"/>` +
      txt(padX + labW + bw + 8, y + 21, String(st.value ?? ""), "s");
  });
  return { w, h, svg: frame(w, h, s.fig ?? "", s.title ?? "", body) };
}

function renderMatrix(s: Spec): { w: number; h: number; svg: string } {
  const cols = s.cols ?? [], rows = s.rows ?? [];
  const labW = 170, cellW = 150, rowH = 34, top = 52, padX = 20;
  const w = padX * 2 + labW + cols.length * cellW;
  const h = top + (rows.length + 1) * rowH + 12;
  let body = `<rect x="${padX}" y="${top}" width="${labW + cols.length * cellW}" height="${(rows.length + 1) * rowH}" rx="6" fill="${CARD}" stroke="${HAIR}"/>`;
  // header
  cols.forEach((c, j) => { body += txt(padX + labW + j * cellW + 10, top + 22, c, "th"); });
  // rows
  rows.forEach((r, i) => {
    const y = top + (i + 1) * rowH;
    body += `<line x1="${padX}" y1="${y}" x2="${padX + labW + cols.length * cellW}" y2="${y}" stroke="${HAIR}"/>`;
    body += lines(padX + 10, y + 21, wrap(r.label, 22, 2), "l", 13);
    (r.cells ?? []).forEach((cell, j) => {
      body += lines(padX + labW + j * cellW + 10, y + 21, wrap(cell, 20, 2), "s", 13);
    });
  });
  // vertical rule after label column
  body += `<line x1="${padX + labW}" y1="${top}" x2="${padX + labW}" y2="${top + (rows.length + 1) * rowH}" stroke="${HAIR}"/>`;
  return { w, h, svg: frame(w, h, s.fig ?? "", s.title ?? "", body) };
}

function flattenTree(n: TreeNode, depth: number, acc: Array<{ n: TreeNode; d: number }>): void {
  acc.push({ n, d: depth });
  for (const c of n.children ?? []) flattenTree(c, depth + 1, acc);
}
function renderTree(s: Spec): { w: number; h: number; svg: string } {
  const flat: Array<{ n: TreeNode; d: number }> = [];
  if (s.root) flattenTree(s.root, 0, flat);
  const rowH = 30, top = 54, padX = 20, indent = 22, w = 660;
  const h = top + flat.length * rowH + 12;
  let body = "";
  flat.forEach((row, i) => {
    const y = top + i * rowH;
    const x = padX + row.d * indent;
    const col = KIND[row.n.kind ?? "field"] ?? PAL.ochre!;
    if (row.d > 0) body += `<path d="M ${x - indent + 5} ${y + 4} L ${x - indent + 5} ${y + 15} L ${x - 3} ${y + 15}" stroke="${HAIR}" fill="none"/>`;
    body +=
      `<circle cx="${x + 5}" cy="${y + 14}" r="4" fill="${col}"/>` +
      txt(x + 16, y + 18, row.n.label, "l") +
      txt(x + 16 + Math.min(220, row.n.label.length * 7 + 12), y + 18, wrap(row.n.sum ?? "", 60, 1)[0]!, "s");
  });
  return { w, h, svg: frame(w, h, s.fig ?? "", s.title ?? "", body) };
}

const RENDER: Record<string, (s: Spec) => { w: number; h: number; svg: string }> = {
  flow: renderFlow, funnel: renderFunnel, matrix: renderMatrix, tree: renderTree,
};

/** Recursively collect (figid, spec) pairs from a possibly by-slug-nested export object. */
function collectSpecs(obj: unknown, out: Array<[string, Spec]>): void {
  if (!obj || typeof obj !== "object") return;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (val && typeof val === "object" && typeof (val as Spec).type === "string" && RENDER[(val as Spec).type]) {
      out.push([key, val as Spec]);
    } else if (val && typeof val === "object") {
      collectSpecs(val, out);
    }
  }
}

interface ManifestEntry { file: string; figid: string; type: string; title: string; caption: string; svg: string; w: number; h: number }

const files = readdirSync(FIG_DIR).filter((f) => f.endsWith(".js")).sort();
const svgs: Array<[string, string]> = [];
const manifest: ManifestEntry[] = [];

for (const f of files) {
  const mod = (await import(pathToFileURL(join(FIG_DIR, f)).href)) as Record<string, unknown>;
  const raw = (mod.default ?? mod.figures ?? mod) as unknown;
  const specs: Array<[string, Spec]> = [];
  collectSpecs(raw, specs);
  const base = basename(f, ".js");
  for (const [figid, spec] of specs) {
    const r = RENDER[spec.type]!(spec);
    const name = `${base}__${figid}.svg`;
    svgs.push([name, r.svg + "\n"]);
    manifest.push({
      file: f, figid, type: spec.type, title: spec.title ?? "", caption: spec.caption ?? "",
      svg: `docs/generated/figures/${name}`, w: r.w, h: r.h,
    });
  }
}

const manifestJson = JSON.stringify(manifest, null, 2) + "\n";

if (checkOnly) {
  let stale = false;
  const cmp = (path: string, body: string): void => {
    let existing = "";
    try { existing = readFileSync(path, "utf8"); } catch { console.error(`docs-figures:check: missing ${relative(ROOT, path)}`); stale = true; return; }
    if (existing !== body) { console.error(`docs-figures:check: ${relative(ROOT, path)} is stale`); stale = true; }
  };
  cmp(MANIFEST, manifestJson);
  for (const [name, svg] of svgs) cmp(join(OUT_DIR, name), svg);
  if (stale) { console.error("docs-figures:check: run `bun run scripts/docs-figures.ts` and commit."); process.exit(1); }
  console.log(`docs-figures:check: ${svgs.length} figures current`);
} else {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, svg] of svgs) writeFileSync(join(OUT_DIR, name), svg, "utf8");
  writeFileSync(MANIFEST, manifestJson, "utf8");
  const byType = manifest.reduce<Record<string, number>>((a, m) => ((a[m.type] = (a[m.type] ?? 0) + 1), a), {});
  console.log(`wrote ${svgs.length} figure SVGs + figures.json (${Object.entries(byType).map(([k, v]) => `${v} ${k}`).join(", ")})`);
}
