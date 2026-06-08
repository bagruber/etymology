import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { WordNode } from "../data/schema.ts";

interface Props {
  nodes: WordNode[];
  autoFocus?: boolean;
}

// Client-side search over native label, Latin transliteration and gloss.
// Selecting a result navigates to that word's lineage page.
export default function SearchBar({ nodes, autoFocus }: Props) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return nodes
      .filter((n) =>
        [n.label, n.latin ?? "", n.gloss ?? "", n.langLabel].some((field) =>
          field.toLowerCase().includes(q)
        )
      )
      .slice(0, 8);
  }, [query, nodes]);

  const go = (id: string) => {
    setQuery("");
    navigate(`/word/${id}`);
  };

  return (
    <div className="search">
      <input
        className="search-input"
        placeholder="Type a word — door, Tür, برادر, father…"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) go(matches[0].id);
        }}
      />
      {matches.length > 0 && (
        <ul className="search-results">
          {matches.map((n) => (
            <li key={n.id}>
              <button className={`search-result lang-${n.lang}`} onClick={() => go(n.id)}>
                <span className="search-result-label">{n.label}</span>
                {n.latin && <span className="search-result-latin">{n.latin}</span>}
                <span className="search-result-meta">
                  {n.langLabel}
                  {n.gloss ? ` · ${n.gloss}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
