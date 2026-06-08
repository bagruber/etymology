import type { EdgeType, WordNode } from "../data/schema.ts";
import { getSpine, type GraphIndex } from "./graph.ts";

export interface PlacedNode {
  node: WordNode;
  x: number; // grid column (0 = spine centre, +/- for branches)
  y: number; // grid row (0 = root at top, increasing downward = depth from root)
  isFocus: boolean;
  isSpine: boolean;
}

export interface PlacedLink {
  from: { x: number; y: number };
  to: { x: number; y: number };
  type: EdgeType;
}

export interface Layout {
  nodes: PlacedNode[];
  links: PlacedLink[];
  minX: number;
  maxX: number;
  maxY: number;
}

/**
 * Pure layout: assigns abstract grid coordinates. The spine (root → focus) is
 * the vertical centre (x = 0) with the focus at the bottom and the root at the
 * top. Every off-spine descendant is laid out as a proper subtree to one side
 * (alternating left/right per top-level branch): leaves take successive columns
 * and each parent is centred over its children, so branches that themselves
 * split (e.g. Proto-Germanic → English *and* German) show every cognate.
 */
export function computeLayout(index: GraphIndex, focusId: string): Layout {
  const spine = getSpine(index, focusId);
  const onSpine = new Set(spine.map((n) => n.id));
  const placed = new Map<string, PlacedNode>();
  const seen = new Set<string>();

  // Spine: x = 0, y = depth from root (root at y = 0, focus at the bottom).
  const topRow = spine.length - 1;
  spine.forEach((node, i) => {
    seen.add(node.id);
    placed.set(node.id, { node, x: 0, y: topRow - i, isFocus: node.id === focusId, isSpine: true });
  });

  // Column cursors growing outward from the spine on each side.
  let rightCol = 1;
  let leftCol = -1;
  const layoutSubtree = (nodeId: string, depth: number, side: 1 | -1): number => {
    seen.add(nodeId);
    const childIds = (index.childEdges.get(nodeId) ?? [])
      .map((e) => e.from)
      .filter((id) => !onSpine.has(id) && !seen.has(id));

    let x: number;
    if (childIds.length === 0) {
      x = side === 1 ? rightCol++ : leftCol--; // leaf claims the next column
    } else {
      const xs = childIds.map((id) => layoutSubtree(id, depth + 1, side));
      x = xs.reduce((a, b) => a + b, 0) / xs.length; // centre over children
    }
    placed.set(nodeId, { node: index.byId.get(nodeId)!, x, y: depth, isFocus: false, isSpine: false });
    return x;
  };

  // Collect every off-spine top-level branch with the width (leaf count) it
  // needs, then assign the widest first to whichever side is lighter — this
  // keeps the radial fan roughly balanced around the spine.
  const seeds = spine.flatMap((s) =>
    (index.childEdges.get(s.id) ?? [])
      .filter((e) => !onSpine.has(e.from))
      .map((e) => ({ childId: e.from, depth: placed.get(s.id)!.y + 1, width: leafCount(index, e.from, onSpine) }))
  );
  seeds.sort((a, b) => b.width - a.width);

  let rightWidth = 0;
  let leftWidth = 0;
  for (const seed of seeds) {
    const side: 1 | -1 = rightWidth <= leftWidth ? 1 : -1;
    if (side === 1) rightWidth += seed.width;
    else leftWidth += seed.width;
    layoutSubtree(seed.childId, seed.depth, side);
  }

  // Links for every edge whose endpoints are both placed.
  const links: PlacedLink[] = [];
  for (const edges of index.parentEdges.values()) {
    for (const edge of edges) {
      const child = placed.get(edge.from);
      const parent = placed.get(edge.to);
      if (child && parent) links.push({ from: child, to: parent, type: edge.type });
    }
  }

  const xs = [...placed.values()].map((p) => p.x);
  const ys = [...placed.values()].map((p) => p.y);
  return {
    nodes: [...placed.values()],
    links,
    minX: Math.min(0, ...xs),
    maxX: Math.max(0, ...xs),
    maxY: Math.max(0, ...ys),
  };
}

/** Number of off-spine leaves under `nodeId` (its rendered horizontal width). */
function leafCount(index: GraphIndex, nodeId: string, onSpine: Set<string>): number {
  const kids = (index.childEdges.get(nodeId) ?? [])
    .map((e) => e.from)
    .filter((id) => !onSpine.has(id));
  if (kids.length === 0) return 1;
  return kids.reduce((sum, id) => sum + leafCount(index, id, onSpine), 0);
}
