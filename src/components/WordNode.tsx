import { Link } from "react-router-dom";
import type { WordNode as WordNodeData } from "../data/schema.ts";

interface Props {
  node: WordNodeData;
  isFocus: boolean;
  /** "lineage" = full-size selected lineage; "peer" = smaller same-level relative. */
  kind: "lineage" | "peer";
}

// A clickable word card: native script primary, Latin transliteration secondary,
// language tag underneath. Navigating re-roots the tree on this word.
export default function WordNode({ node, isFocus, kind }: Props) {
  const className = [
    "word-card",
    isFocus ? "is-focus" : "",
    kind === "peer" ? "is-peer" : "is-lineage",
    `lang-${node.lang}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={`/word/${node.id}`} className={className} title={node.gloss ?? ""}>
      <span className="word-label">{node.label}</span>
      {node.latin && <span className="word-latin">{node.latin}</span>}
      <span className="word-lang">{node.langLabel}</span>
    </Link>
  );
}
