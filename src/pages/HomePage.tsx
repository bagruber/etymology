import { Link } from "react-router-dom";
import type { WordNode } from "../data/schema.ts";
import SearchBar from "../components/SearchBar.tsx";

interface Props {
  nodes: WordNode[];
}

// Suggested entry points — a spread of languages and roots.
const EXAMPLES = ["en-door", "en-father", "fa-baradar", "de-mutter", "en-three", "la-nomen"];

export default function HomePage({ nodes }: Props) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    <main className="home">
      <h1 className="home-title">Etymology Tree</h1>
      <p className="home-tagline">
        Trace a word back to its Proto-Indo-European root and across to its cognates
        in other languages.
      </p>
      <SearchBar nodes={nodes} autoFocus />
      <div className="home-examples">
        <span>Try:</span>
        {EXAMPLES.map((id) => {
          const n = byId.get(id);
          return n ? (
            <Link key={id} to={`/word/${id}`} className="chip">
              {n.label}
            </Link>
          ) : null;
        })}
      </div>
    </main>
  );
}
