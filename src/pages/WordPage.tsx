import { Link, useParams } from "react-router-dom";
import type { GraphIndex } from "../graph/graph.ts";
import { relatedNodes } from "../graph/graph.ts";
import type { WordNode } from "../data/schema.ts";
import LineageTree from "../components/LineageTree.tsx";
import DetailPanel from "../components/DetailPanel.tsx";
import SearchBar from "../components/SearchBar.tsx";

interface Props {
  index: GraphIndex;
  nodes: WordNode[];
}

export default function WordPage({ index, nodes }: Props) {
  const { id = "" } = useParams();
  const node = index.byId.get(id);

  if (!node) {
    return (
      <main className="word-page">
        <p className="not-found">
          No word found for “{id}”. <Link to="/">Back to search</Link>.
        </p>
      </main>
    );
  }

  return (
    <main className="word-page">
      <div className="word-page-bar">
        <Link to="/" className="brand">
          Etymology Tree
        </Link>
        <SearchBar nodes={nodes} />
      </div>
      <div className="tree-scroll">
        <LineageTree index={index} focusId={id} />
      </div>
      <DetailPanel node={node} related={relatedNodes(index, id)} />
    </main>
  );
}
