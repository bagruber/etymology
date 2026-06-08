import { useMemo } from "react";
import { Link } from "react-router-dom";
import { lineageIds, type GraphIndex } from "../graph/graph.ts";
import { TIER } from "../data/tiers.ts";
import { computeLayout, type PlacedLink } from "../graph/layout.ts";
import WordNode from "./WordNode.tsx";

type NodeKind = "lineage" | "peer" | "dot";

interface Props {
  index: GraphIndex;
  focusId: string;
}

// Geometry: columns map to fixed horizontal spacing (so cards never crowd),
// depth maps to vertical rows. Each row is then bowed upward at the edges by a
// parabolic LIFT, so the spine stays straight down and the cognates arc around
// the PIE root — zoomed out, the root sits at the top of a gentle circle.
const COL = 185; // px per column (> card width, so no overlap)
const ROW = 155; // px per depth step
const LIFT = 13; // px of upward bow per column², strength of the curve
const CARD_W = 150;
const CARD_H = 86;
const PAD = 90;

const DASHED_TYPES = new Set(["cognate", "borrowed", "derived"]);

// Grid (column, depth) -> pixel offset from the root (origin), down = +y.
function place(gridX: number, gridY: number): { x: number; y: number } {
  return { x: gridX * COL, y: gridY * ROW - LIFT * gridX * gridX };
}

export default function LineageTree({ index, focusId }: Props) {
  const view = useMemo(() => {
    const layout = computeLayout(index, focusId);
    const pts = layout.nodes.map((n) => place(n.x, n.y));
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    const ox = PAD + CARD_W / 2 - minX;
    const oy = PAD + CARD_H / 2 - minY;
    const toPx = (gridX: number, gridY: number) => {
      const q = place(gridX, gridY);
      return { cx: q.x + ox, cy: q.y + oy };
    };

    // Classify: the focus's own lineage gets full cards; cognates at the same
    // era tier get smaller cards; everything else is just a connecting dot.
    const lineage = lineageIds(index, focusId);
    const focusTier = TIER[index.byId.get(focusId)!.lang];
    const kindOf = (lang: string, id: string): NodeKind =>
      lineage.has(id) ? "lineage" : TIER[lang as keyof typeof TIER] === focusTier ? "peer" : "dot";

    return {
      nodes: layout.nodes,
      links: layout.links,
      toPx,
      kindOf,
      width: maxX - minX + CARD_W + PAD * 2,
      height: maxY - minY + CARD_H + PAD * 2,
    };
  }, [index, focusId]);

  return (
    <div className="lineage" style={{ width: view.width, height: view.height }}>
      <svg className="lineage-links" width={view.width} height={view.height} aria-hidden="true">
        {view.links.map((link, i) => (
          <path key={i} d={linkPath(link, view.toPx)} className={linkClass(link)} />
        ))}
      </svg>
      {view.nodes.map((p) => {
        const { cx, cy } = view.toPx(p.x, p.y);
        const kind = view.kindOf(p.node.lang, p.node.id);
        if (kind === "dot") {
          return (
            <Link
              key={p.node.id}
              to={`/word/${p.node.id}`}
              className="lineage-dot"
              style={{ left: cx, top: cy }}
              title={`${p.node.label}${p.node.latin ? ` (${p.node.latin})` : ""} — ${p.node.langLabel}`}
            />
          );
        }
        return (
          <div
            key={p.node.id}
            className="lineage-node"
            style={{ left: cx - CARD_W / 2, top: cy - CARD_H / 2, width: CARD_W, height: CARD_H }}
          >
            <WordNode node={p.node} isFocus={p.isFocus} kind={kind} />
          </div>
        );
      })}
    </div>
  );
}

// Curve that follows the parent's spoke down to the mid radius, then swings to
// the child's spoke — straight for the spine, gently arced for branches.
function linkPath(link: PlacedLink, toPx: (x: number, y: number) => { cx: number; cy: number }) {
  const parent = toPx(link.to.x, link.to.y);
  const child = toPx(link.from.x, link.from.y);
  const midDepth = (link.to.y + link.from.y) / 2;
  const c1 = toPx(link.to.x, midDepth);
  const c2 = toPx(link.from.x, midDepth);
  return `M ${parent.cx} ${parent.cy} C ${c1.cx} ${c1.cy}, ${c2.cx} ${c2.cy}, ${child.cx} ${child.cy}`;
}

function linkClass(link: PlacedLink): string {
  return DASHED_TYPES.has(link.type) ? "link link-dashed" : "link";
}
