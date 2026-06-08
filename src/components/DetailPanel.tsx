import { Link } from "react-router-dom";
import type { WordNode } from "../data/schema.ts";

interface Props {
  node: WordNode;
  related: WordNode[];
}

// The read-up section: gloss, prose etymology and links to directly related forms.
export default function DetailPanel({ node, related }: Props) {
  return (
    <section className="detail">
      <header className="detail-head">
        <h1 className="detail-title">
          {node.label}
          {node.latin && <span className="detail-latin">{node.latin}</span>}
        </h1>
        <span className="detail-lang">{node.langLabel}</span>
      </header>

      {node.gloss && <p className="detail-gloss">“{node.gloss}”</p>}
      {node.notes && <p className="detail-notes">{node.notes}</p>}

      {related.length > 0 && (
        <div className="detail-related">
          <h2>Related forms</h2>
          <ul>
            {related.map((r) => (
              <li key={r.id}>
                <Link to={`/word/${r.id}`}>
                  {r.label}
                  {r.latin ? ` (${r.latin})` : ""} — {r.langLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
