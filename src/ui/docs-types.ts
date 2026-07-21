/** Shared wire types for the generated documentation corpus. */
export interface DocAnchor {
  text: string;
  slug: string;
  level: number;
}

export interface DocRecord {
  id: string;
  path: string;
  title: string;
  audience: string;
  summary: string;
  tags: string[];
  related: string[];
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
