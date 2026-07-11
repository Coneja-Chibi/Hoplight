/**
 * Pure force-directed layout tick for the Web lens. View owns rAF/drag; sim owns math.
 */
export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** pinned while dragging */
  pinned?: boolean;
  cluster: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
}

export interface LayoutBounds {
  width: number;
  height: number;
}

const REPULSION = 900;
const SPRING = 0.04;
const REST = 90;
const GRAVITY = 0.01;
const DAMPING = 0.85;
export const WEB_NODE_CAP = 200;

/**
 * Connected-component labels (0..n-1) for cluster colors. Deterministic given edge order.
 */
export function componentLabels(
  nodeIds: readonly string[],
  edges: readonly LayoutEdge[],
): Map<string, number> {
  const parent = new Map<string, string>();
  for (const id of nodeIds) parent.set(id, id);
  const find = (a: string): string => {
    let x = a;
    while (parent.get(x) !== x) x = parent.get(x)!;
    return x;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const e of edges) {
    if (parent.has(e.from) && parent.has(e.to)) union(e.from, e.to);
  }
  const roots = new Map<string, number>();
  let n = 0;
  const out = new Map<string, number>();
  for (const id of nodeIds) {
    const r = find(id);
    if (!roots.has(r)) {
      roots.set(r, n);
      n += 1;
    }
    out.set(id, roots.get(r)!);
  }
  return out;
}

/** One simulation step. Deterministic for the same inputs. */
export function stepLayout(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[],
  bounds: LayoutBounds,
): LayoutNode[] {
  const next = nodes.map((n) => ({ ...n }));
  const byId = new Map(next.map((n) => [n.id, n]));
  const cx = bounds.width / 2;
  const cy = bounds.height / 2;

  // repulsion
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i]!;
      const b = next[j]!;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        dx = 0.01;
        dy = 0.01;
        d2 = 0.0002;
      }
      const f = REPULSION / d2;
      const fx = (dx / Math.sqrt(d2)) * f;
      const fy = (dy / Math.sqrt(d2)) * f;
      if (!a.pinned) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.pinned) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }
  }

  // springs
  for (const e of edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const force = (dist - REST) * SPRING;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    if (!a.pinned) {
      a.vx += fx;
      a.vy += fy;
    }
    if (!b.pinned) {
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  // gravity + integrate
  for (const n of next) {
    if (n.pinned) {
      n.vx = 0;
      n.vy = 0;
      continue;
    }
    n.vx += (cx - n.x) * GRAVITY;
    n.vy += (cy - n.y) * GRAVITY;
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;
    n.x = Math.max(8, Math.min(bounds.width - 8, n.x));
    n.y = Math.max(8, Math.min(bounds.height - 8, n.y));
  }

  return next;
}

/** Seed nodes in a circle; assign clusters. */
export function seedLayout(
  nodeIds: readonly string[],
  edges: readonly LayoutEdge[],
  bounds: LayoutBounds,
): LayoutNode[] {
  const clusters = componentLabels(nodeIds, edges);
  const n = Math.max(nodeIds.length, 1);
  return nodeIds.map((id, i) => {
    const angle = (i / n) * Math.PI * 2;
    const r = Math.min(bounds.width, bounds.height) * 0.28;
    return {
      id,
      x: bounds.width / 2 + Math.cos(angle) * r,
      y: bounds.height / 2 + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
      cluster: clusters.get(id) ?? 0,
    };
  });
}
