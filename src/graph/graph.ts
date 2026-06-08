import type { Dataset, Edge, WordNode } from "../data/schema.ts";

export interface GraphIndex {
  byId: Map<string, WordNode>;
  /** child id -> edges pointing to its parents (ancestors). */
  parentEdges: Map<string, Edge[]>;
  /** parent id -> edges coming from its children (descendants). */
  childEdges: Map<string, Edge[]>;
}

export function buildIndex(dataset: Dataset): GraphIndex {
  const byId = new Map<string, WordNode>();
  const parentEdges = new Map<string, Edge[]>();
  const childEdges = new Map<string, Edge[]>();

  for (const node of dataset.nodes) byId.set(node.id, node);
  for (const edge of dataset.edges) {
    push(parentEdges, edge.from, edge);
    push(childEdges, edge.to, edge);
  }
  return { byId, parentEdges, childEdges };
}

function push(map: Map<string, Edge[]>, key: string, edge: Edge): void {
  const list = map.get(key);
  if (list) list.push(edge);
  else map.set(key, [edge]);
}

/**
 * The vertical spine: the chain of ancestors from `focusId` up to the root
 * (a node with no parent edges). Ordered focus-first; the renderer puts the
 * focus at the bottom and the root at the top.
 */
export function getSpine(index: GraphIndex, focusId: string): WordNode[] {
  const spine: WordNode[] = [];
  const seen = new Set<string>();
  let current: string | undefined = focusId;

  while (current && index.byId.has(current) && !seen.has(current)) {
    seen.add(current);
    spine.push(index.byId.get(current)!);
    // Follow the first parent edge upward (curated data is a tree, so each
    // node has at most one parent).
    current = index.parentEdges.get(current)?.[0]?.to;
  }
  return spine;
}

/**
 * Ids on the focus's own lineage: its ancestor spine plus all of its
 * descendants. These are drawn as full-size cards; everything else is a
 * same-level peer (small card) or just a dot.
 */
export function lineageIds(index: GraphIndex, focusId: string): Set<string> {
  const ids = new Set(getSpine(index, focusId).map((n) => n.id));
  const stack = [focusId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const edge of index.childEdges.get(id) ?? []) {
      if (!ids.has(edge.from)) {
        ids.add(edge.from);
        stack.push(edge.from);
      }
    }
  }
  return ids;
}

/** Directly related forms (parents + children) for the detail panel. */
export function relatedNodes(index: GraphIndex, id: string): WordNode[] {
  const ids = new Set<string>();
  for (const e of index.parentEdges.get(id) ?? []) ids.add(e.to);
  for (const e of index.childEdges.get(id) ?? []) ids.add(e.from);
  return [...ids].map((i) => index.byId.get(i)!).filter(Boolean);
}
