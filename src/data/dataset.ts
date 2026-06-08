import type { Dataset } from "./schema.ts";
import curated from "./curated.json";
import generated from "./generated.json";

// Single source of truth for the app. Defaults to the curated dataset; set
// VITE_DATA=generated (e.g. `VITE_DATA=generated npm run dev`) to load the
// JSON produced by the Wiktionary ingestion pipeline (see ../../ingestion).
// The generated data carries language codes outside our `Lang` union, hence
// the unchecked cast — the UI degrades gracefully (see tierOf in ./tiers).
const useGenerated = import.meta.env.VITE_DATA === "generated";
export const dataset: Dataset = (useGenerated ? generated : curated) as unknown as Dataset;
