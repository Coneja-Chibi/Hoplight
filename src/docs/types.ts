/**
 * Shared wire types for Hoplight's generated documentation corpus.
 */
export interface DocAnchor {
  text: string;
  slug: string;
  level: 2 | 3;
  /** Semantic section summary; empty string when no sidecar is merged. */
  summary: string;
  topics: string[];
  children: DocAnchor[];
}

export interface DocRecord {
  id: string;
  path: string;
  title: string;
  audience: string;
  /** Short frontmatter or first-paragraph description. */
  summary: string;
  tags: string[];
  related: string[];
  /** Complete semantic page overview; empty string when no sidecar is merged. */
  semanticSummary: string;
  topics: string[];
  anchors: DocAnchor[];
}

export interface DocsIndex {
  generated: string;
  count: number;
  docs: DocRecord[];
}

export interface DocFigure {
  file: string;
  figid: string;
  type: string;
  title: string;
  caption: string;
  svg: string;
  w: number;
  h: number;
}

export interface PackagedDocAsset {
  mime: string;
  b64: string;
}

export interface PackagedDocs {
  index: DocsIndex;
  pages: Record<string, string>;
  figures: DocFigure[];
  assets: Record<string, PackagedDocAsset>;
}
