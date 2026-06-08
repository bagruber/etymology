import type { Dataset } from "./schema.ts";
import raw from "./curated.json";

// Single source of truth for the app. A real ingestion pipeline (see
// ../../ingestion) would produce a JSON of this exact shape, so this is the
// only line that would change when swapping curated data for real data.
export const dataset: Dataset = raw as Dataset;
