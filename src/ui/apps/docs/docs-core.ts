/** Pure catalog, search, link, and figure derivation for the in-app docs reader. */
import type { DocFigure, DocRecord } from "../../docs-types";

export type DocSegment =
  | { kind: "markdown"; body: string }
  | { kind: "asset"; path: string; alt: string; caption?: string; width?: number; height?: number };

export interface DocNavSection { id: string; label: string; docs: DocRecord[] }
export interface DocNavGroup { id: "user" | "developer"; label: string; sections: DocNavSection[] }

const SECTION_ORDER = {
  user: ["start", "workflows", "content", "platforms", "safety"],
  developer: ["overview", "application", "architecture", "model", "formats", "security", "extending", "decisions"],
} as const;

const sectionFor = (doc: DocRecord): { group: "user" | "developer"; id: string; label: string } => {
  const path = doc.path;
  if (path.startsWith("docs/guide/")) {
    if (path.startsWith("docs/guide/platforms/")) return { group: "user", id: "platforms", label: "Platform Guides" };
    if (/\/(?:README|getting-started|faq|troubleshooting)\.md$/.test(path)) return { group: "user", id: "start", label: "Start Here" };
    if (/\/(?:lorebooks|personas|regex)\.md$/.test(path)) return { group: "user", id: "content", label: "Content Guides" };
    if (path.endsWith("/security.md")) return { group: "user", id: "safety", label: "Safety & Privacy" };
    return { group: "user", id: "workflows", label: "Workflows" };
  }
  if (path.startsWith("docs/decisions/")) return { group: "developer", id: "decisions", label: "Technical Decisions" };
  if (path.startsWith("docs/reference/security/")) return { group: "developer", id: "security", label: "Security Engineering" };
  if (path.startsWith("docs/reference/formats/") || /(?:FORMAT-SUPPORT|platform-native-fields)\.md$/.test(path)) {
    return { group: "developer", id: "formats", label: "Formats & Compatibility" };
  }
  if (path.startsWith("docs/reference/entities/")) return { group: "developer", id: "model", label: "Data Model" };
  if (path.startsWith("docs/reference/concepts/") || path.endsWith("reference/architecture.md")) {
    return { group: "developer", id: "architecture", label: "Architecture & Concepts" };
  }
  if (path.startsWith("docs/reference/extending/")) return { group: "developer", id: "extending", label: "Extending Hoplight" };
  if (/docs\/reference\/(?:ui|cli|components)\.md$/.test(path)) {
    return { group: "developer", id: "application", label: "Application & API" };
  }
  return { group: "developer", id: "overview", label: "Project Overview" };
};

const TITLE_OVERRIDES: Readonly<Record<string, string>> = {
  "README": "Documentation home",
  "01-VISION": "Product vision",
  "02-ARCHITECTURE": "Architecture brief",
  "03-CONVENTIONS": "Engineering conventions",
  "reference/README": "Developer reference",
  "guide/README": "User docs overview",
  "guide/platforms/README": "Platform overview",
  "reference/entities/README": "Data model overview",
  "reference/formats/README": "Format overview",
  "reference/security/README": "Security overview",
  "reference/ui": "Studio application & local API",
  "reference/components": "UI component catalog",
};

const NAV_PRIORITY = [
  "README", "guide/README", "guide/getting-started", "guide/faq", "guide/troubleshooting",
  "guide/importing", "guide/library", "guide/editing", "guide/converting", "guide/exporting",
  "guide/platforms/README", "reference/README", "01-VISION", "02-ARCHITECTURE", "03-CONVENTIONS",
  "ROADMAP", "reference/ui", "reference/cli", "reference/components", "reference/architecture",
  "reference/concepts/canonical-model", "reference/concepts/escrow-and-roundtrip",
  "reference/concepts/detection", "reference/concepts/bundles", "reference/concepts/character-book",
  "reference/entities/README", "FORMAT-SUPPORT", "reference/formats/README",
  "reference/platform-native-fields", "reference/security/README",
] as const;

const navRank = (doc: DocRecord): number => {
  const rank = NAV_PRIORITY.indexOf(doc.id as typeof NAV_PRIORITY[number]);
  return rank === -1 ? NAV_PRIORITY.length : rank;
};

export function displayDocTitle(doc: DocRecord): string {
  const override = TITLE_OVERRIDES[doc.id];
  if (override) return override;
  if (doc.path.startsWith("docs/reference/concepts/")) return doc.title.replace(/^Concept:\s*/, "");
  if (!doc.path.startsWith("docs/decisions/")) return doc.title;
  return doc.title
    .replace(/^ADR-\d+:\s*/, "")
    .replace(/\s*\(supersedes ADR-\d+[^)]*\)/i, "")
    .replace(" - ", ": ");
}

export function groupDocs(docs: DocRecord[]): DocNavGroup[] {
  const groups: Record<"user" | "developer", Map<string, DocNavSection>> = {
    user: new Map(),
    developer: new Map(),
  };
  for (const doc of docs) {
    const info = sectionFor(doc);
    const section = groups[info.group].get(info.id) ?? { id: info.id, label: info.label, docs: [] };
    section.docs.push(doc);
    groups[info.group].set(info.id, section);
  }
  return (["user", "developer"] as const).flatMap((id) => {
    const sections = SECTION_ORDER[id]
      .map((sectionId) => groups[id].get(sectionId))
      .filter((section): section is DocNavSection => Boolean(section))
      .map((section) => ({
        ...section,
        docs: [...section.docs].sort((a, b) => {
          if (section.id === "decisions") return a.path.localeCompare(b.path);
          return navRank(a) - navRank(b) || displayDocTitle(a).localeCompare(displayDocTitle(b));
        }),
      }));
    return sections.length ? [{ id, label: id === "user" ? "User Docs" : "Developer Docs", sections }] : [];
  });
}

const flattenAnchors = (anchors: DocRecord["anchors"]): DocRecord["anchors"] => {
  const out: DocRecord["anchors"] = [];
  for (const anchor of anchors) {
    out.push(anchor);
    if (anchor.children?.length) out.push(...flattenAnchors(anchor.children));
  }
  return out;
};

export function searchDocs(docs: DocRecord[], rawQuery: string): DocRecord[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return docs;
  return docs.filter((doc) => {
    const flat = flattenAnchors(doc.anchors);
    return [
      doc.title,
      doc.summary,
      doc.semanticSummary ?? "",
      ...doc.tags,
      ...(doc.topics ?? []),
      ...flat.map((anchor) => anchor.text),
      ...flat.map((anchor) => anchor.summary ?? ""),
      ...flat.flatMap((anchor) => anchor.topics ?? []),
    ].join(" ").toLowerCase().includes(query);
  });
}

export function stripFrontmatter(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  const after = raw.indexOf("\n", end + 1);
  return after === -1 ? "" : raw.slice(after + 1);
}

const normalizeRepoPath = (path: string): string | null => {
  const out: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else {
      out.push(part);
    }
  }
  return out.join("/");
};

const dirname = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf("/")));

const splitHref = (href: string): { path: string; anchor: string } => {
  const hash = href.indexOf("#");
  return hash === -1 ? { path: href, anchor: "" } : { path: href.slice(0, hash), anchor: href.slice(hash + 1) };
};

const resolveRelative = (href: string, currentPath: string): string | null => {
  if (href.startsWith("/")) return normalizeRepoPath(href);
  return normalizeRepoPath(`${dirname(currentPath)}/${href}`);
};

function rewriteDocLinks(markdown: string, current: DocRecord, docs: DocRecord[]): string {
  const byPath = new Map(docs.map((doc) => [doc.path, doc]));
  return markdown.replace(/(?<!!)\[([^\]]+)\]\(([^)\s]+)([^)]*)\)/g, (whole, label: string, rawHref: string, tail: string) => {
    if (/^(?:https?:|mailto:|#)/i.test(rawHref)) return whole;
    const { path, anchor } = splitHref(rawHref);
    const resolved = resolveRelative(path, current.path);
    if (!resolved) return whole;
    const target = byPath.get(resolved);
    if (target) {
      const hash = anchor ? `#${anchor}` : "";
      return `[${label}](/docs/${encodeURIComponent(target.id)}${hash}${tail})`;
    }
    const github = `https://github.com/Coneja-Chibi/Hoplight/blob/Mainstage/${resolved}`;
    return `[${label}](${github}${anchor ? `#${anchor}` : ""}${tail})`;
  });
}

const slugify = (text: string): string => text
  .toLowerCase()
  .replace(/`/g, "")
  .replace(/[^\w\s-]/g, "")
  .trim()
  .replace(/\s+/g, "-");

const markHeadings = (markdown: string): string => markdown.replace(
  /^(#{2,3})\s+(.+?)\s*$/gm,
  (whole, _hashes: string, title: string) => `<span id="doc-${slugify(title)}"></span>\n${whole}`,
);

const figureFor = (doc: DocRecord, id: string, figures: DocFigure[]): DocFigure | null => {
  const candidates = figures.filter((figure) => figure.figid === id);
  if (candidates.length === 1) return candidates[0]!;
  const docBase = doc.path.split("/").at(-1)?.replace(/\.md$/, "") ?? "";
  const guide = doc.id.startsWith("guide/");
  const scored = candidates.map((figure) => {
    const base = figure.file.replace(/\.js$/, "");
    let score = base === docBase ? 100 : base.includes(docBase) ? 50 : 0;
    if (guide === base.includes("guide")) score += 10;
    return { figure, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].figure : null;
};

const imageLine = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/;

export function prepareDocSegments(
  raw: string,
  current: DocRecord,
  docs: DocRecord[],
  figures: DocFigure[],
): DocSegment[] {
  const segments: DocSegment[] = [];
  let markdown: string[] = [];
  const flush = (): void => {
    const body = markdown.join("\n").trim();
    if (body) segments.push({ kind: "markdown", body: markHeadings(rewriteDocLinks(body, current, docs)) });
    markdown = [];
  };

  const friendlyBody = stripFrontmatter(raw).replace(/^#\s+.+$/m, `# ${displayDocTitle(current)}`);
  for (const line of friendlyBody.split("\n")) {
    const marker = /^@fig\s+(\S+)\s*$/.exec(line);
    if (marker) {
      const figure = figureFor(current, marker[1]!, figures);
      if (figure) {
        flush();
        segments.push({
          kind: "asset",
          path: figure.svg,
          alt: figure.title || figure.caption || marker[1]!,
          caption: figure.caption,
          width: figure.w,
          height: figure.h,
        });
      }
      continue;
    }

    const image = imageLine.exec(line.trim());
    if (image) {
      const path = resolveRelative(image[2]!, current.path);
      if (path?.startsWith("docs/media/") || path?.startsWith("docs/generated/figures/")) {
        flush();
        segments.push({ kind: "asset", path, alt: image[1] || current.title });
        continue;
      }
    }
    markdown.push(line);
  }
  flush();
  return segments;
}

export function targetFromAppHref(href: string): { id: string; anchor: string } | null {
  const match = /^\/docs\/([^#?]+)(?:#(.*))?$/.exec(href);
  if (!match) return null;
  try {
    return { id: decodeURIComponent(match[1]!), anchor: match[2] ?? "" };
  } catch {
    return null;
  }
}
