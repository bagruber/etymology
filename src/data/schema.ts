// The data model for the etymology graph.
//
// This schema is deliberately identical for the curated demo data and for any
// future real-data ingestion (see ../../ingestion). A real pipeline built on
// droher/etymology-db emits the same `Dataset` shape, so swapping data sources
// requires no application code changes.

// Language / stage codes. Modern: en, de, fa. Proto/historical stages are
// included so a lineage can pass through intermediate forms.
export type Lang =
  | "en" // English
  | "de" // German
  | "fa" // Persian (New Persian, Perso-Arabic script)
  | "la" // Latin
  | "grc" // Ancient Greek
  | "el" // Modern Greek
  | "sa" // Sanskrit
  | "hi" // Hindi
  | "fr" // French
  | "es" // Spanish
  | "it" // Italian
  | "ru" // Russian
  | "pie" // Proto-Indo-European
  | "pgmc" // Proto-Germanic
  | "pira" // Proto-Iranian
  | "psl" // Proto-Slavic
  | "ang" // Old English
  | "goh" // Old High German
  | "pal" // Middle Persian (Pahlavi script)
  | "peo"; // Old Persian (Old Persian cuneiform)

export type EdgeType =
  | "inherited" // passed down within a language's own lineage
  | "derived" // formed/derived from
  | "borrowed" // loaned from another language
  | "cognate" // shares an ancestor (sibling relation)
  | "root"; // link up into a reconstructed root

export interface WordNode {
  /** Stable slug, e.g. "en-door", "fa-dar", "pie-dhwer". */
  id: string;
  /** Native script, shown as the primary label: "door", "Tür", "در", "*dʰwer-". */
  label: string;
  /** Latin transliteration shown smaller; null when `label` is already Latin. */
  latin: string | null;
  lang: Lang;
  /** Human-readable language/stage name, e.g. "Persian", "Proto-Indo-European". */
  langLabel: string;
  /** Short meaning, e.g. "door, gate". */
  gloss?: string;
  /** Prose etymology for the detail panel. */
  notes?: string;
}

/** Directed edge pointing from descendant (child) up to ancestor (parent). */
export interface Edge {
  from: string; // child id (the more recent form)
  to: string; // parent id (the older form / root)
  type: EdgeType;
}

export interface Dataset {
  nodes: WordNode[];
  edges: Edge[];
}
