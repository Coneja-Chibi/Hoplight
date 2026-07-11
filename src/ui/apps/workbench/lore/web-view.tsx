/**
 * Web lens: recursion wake graph (vs-lore-lenses). Links from bookWakeGraph only.
 */
import { useEffect, useMemo, useRef, useState, type JSX, type PointerEvent } from "react";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import {
  bookWakeGraph,
  seedLayout,
  stepLayout,
  WEB_NODE_CAP,
  type LayoutNode,
} from "../../../../core/lore";
import styles from "./web-view.module.css";

export interface WebViewProps {
  body: LorebookBody;
  onSelect: (id: string) => void;
  onFallbackCards: () => void;
}

const CLUSTER = [
  "var(--stage-ok)",
  "var(--stage-var)",
  "var(--a, var(--stage-macro))",
  "var(--stage-warn)",
  "var(--stage-danger-text)",
  "var(--stage-link)",
  "var(--stage-soft)",
  "var(--stage-mute)",
];

export function WebView({ body, onSelect, onFallbackCards }: WebViewProps): JSX.Element {
  const entryIds = useMemo(
    () => body.entries.filter((e) => e.enabled).map((e) => e.id),
    [body],
  );
  const overCap = entryIds.length > WEB_NODE_CAP;
  const { edges } = useMemo(() => bookWakeGraph(body), [body]);
  const layoutEdges = useMemo(
    () => edges.map((e) => ({ from: e.from, to: e.to })),
    [edges],
  );
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [nodes, setNodes] = useState<LayoutNode[]>([]);
  const [running, setRunning] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (overCap) {
      setRunning(false);
      return;
    }
    const bounds = { width: 640, height: 420 };
    setNodes(seedLayout(entryIds, layoutEdges, bounds));
    setRunning(true);
  }, [entryIds, layoutEdges, overCap]);

  useEffect(() => {
    if (overCap || !running) return;
    let raf = 0;
    let alive = true;
    const tick = (): void => {
      if (!alive) return;
      setNodes((n) => stepLayout(n, layoutEdges, { width: 640, height: 420 }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [layoutEdges, overCap, running]);

  if (overCap) {
    return (
      <div className={styles.notice}>
        This book has {entryIds.length} entries (cap {WEB_NODE_CAP}). Showing Cards instead of the web.
        <button type="button" className={styles.link} onClick={onFallbackCards}>
          Open Cards
        </button>
      </div>
    );
  }

  const neighbor = new Set<string>();
  if (hover) {
    neighbor.add(hover);
    for (const e of layoutEdges) {
      if (e.from === hover) neighbor.add(e.to);
      if (e.to === hover) neighbor.add(e.from);
    }
  }

  const onPointerDown = (id: string, ev: PointerEvent): void => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    drag.current = { id, ox: ev.clientX - n.x, oy: ev.clientY - n.y };
    setNodes((list) => list.map((x) => (x.id === id ? { ...x, pinned: true } : x)));
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
  };

  const onPointerMove = (ev: PointerEvent): void => {
    const d = drag.current;
    if (!d) return;
    setNodes((list) =>
      list.map((x) =>
        x.id === d.id
          ? { ...x, x: ev.clientX - d.ox, y: ev.clientY - d.oy, vx: 0, vy: 0 }
          : x,
      ),
    );
  };

  const onPointerUp = (): void => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    setNodes((list) => list.map((x) => (x.id === d.id ? { ...x, pinned: false } : x)));
  };

  const titleOf = (id: string): string =>
    body.entries.find((e) => e.id === id)?.title || id;

  return (
    <div className={styles.wrap} aria-label="Wake web">
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox="0 0 640 420"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {layoutEdges.map((e, i) => {
          const a = nodes.find((n) => n.id === e.from);
          const b = nodes.find((n) => n.id === e.to);
          if (!a || !b) return null;
          const dim = hover && (!neighbor.has(e.from) || !neighbor.has(e.to));
          return (
            <line
              key={`${e.from}-${e.to}-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={dim ? styles.edgeDim : styles.edge}
            />
          );
        })}
        {nodes.map((n) => {
          const degree = layoutEdges.filter((e) => e.from === n.id || e.to === n.id).length;
          const r = 8 + degree * 0.5;
          const loner = degree === 0;
          const dim = hover && !neighbor.has(n.id);
          const fill = loner
            ? "var(--stage-faint)"
            : CLUSTER[n.cluster % CLUSTER.length]!;
          return (
            <g
              key={n.id}
              className={dim ? styles.nodeDim : styles.node}
              onPointerDown={(ev) => onPointerDown(n.id, ev)}
              onPointerEnter={() => setHover(n.id)}
              onPointerLeave={() => setHover(null)}
              onDoubleClick={() => onSelect(n.id)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={n.x} cy={n.y} r={r} fill={fill} stroke="var(--stage-black)" strokeWidth={2} />
              <text x={n.x} y={n.y + r + 12} textAnchor="middle" className={styles.label}>
                {titleOf(n.id).slice(0, 18)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className={styles.hint}>Drag to pin · double-click opens Pages · grey nodes wake nobody</p>
    </div>
  );
}
