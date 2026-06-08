# Wiktionary etymology pipeline

`build-dataset.ts` builds the app's `Dataset` shape (see
[`../src/data/schema.ts`](../src/data/schema.ts)) directly from the **live
English Wiktionary** via the MediaWiki API — no bulk download required.

## Run

```bash
npm run ingest -- door father three name > ingestion/out.json
```

Each argument is an English seed word. The script prints a summary to stderr and
the `Dataset` JSON to stdout.

## How it works

For each seed it:

1. Fetches the page wikitext (`action=query&prop=revisions`).
2. Extracts the `==English==` → `===Etymology===` section.
3. Parses the etymology templates:
   - `{{inh|en|<lang>|<term>}}`, `{{der|…}}`, `{{bor|…}}` → the ancestor chain,
     wired as child→parent edges up to the Proto-Indo-European root.
   - `{{cog|<lang>|<term>}}` → cognates. For each cognate in a target language it
     recurses **one level**, fetching that word's page and building its own chain,
     so cognates arrive with their full lineage rather than as bare leaves.
4. Maps Wiktionary language codes → our `lang` codes / labels / tiers (see
   `LANGS` in the script). Unknown codes pass through with a tier-2 default.

## Convergence + sense filtering (done)

- **Root convergence.** Each page's `{{root|…|ine-pro|*X}}` gives the deep
  canonical root; the chain's top is linked up to it, so sibling branches meet
  on one node (e.g. door / Tür / foris / θύρα / در all reach `*dʰwer-`). The
  chain's own PIE lemma (`*ph₂tḗr`, `*dʰwṓr`) is preserved as an intermediate
  node rather than collapsed into the deeper verbal root (`*peh₂-`).
- **Stop at PIE.** The chain stops at its first PIE node, so a second sense in
  the same section (e.g. "mother" = dregs → `*muþraz`) no longer pollutes it.
- **Section start fix.** Language sections are found even when first on the page
  (no `{{also}}` hatnote), e.g. Latin-only `foris`.
- **Multiword cognates dropped** (`mère de vinaigre` under "mother").
- **On-disk cache** (`ingestion/.cache`, gitignored) makes re-runs instant.

## Still open (the genuinely hard parts)

- **Multi-etymology headwords.** A cognate page with two unrelated etymologies
  (e.g. Persian در "door" vs اندر "within" ← `*h₁énteros`) can still bleed the
  wrong sense in, since we take the first etymology blindly.
- **Single-word wrong-sense cognates** (e.g. German `Essigmutter`) slip past the
  multiword filter.
- **Rate limiting.** This IP gets throttled hard; cognate fetches that fail
  return empty and leave isolated nodes until a later run caches them.
- **Comma-batched cognates** (`{{cog|da,nb,nn|dør}}`) and unmapped language
  codes are still skipped / passed through.
- **IDs + transliteration + language registry** (workstream #2): non-Latin ids
  are mangled by `slug()`, `latin` is always null, and many codes lack a
  tier/script/font mapping.

## Wiring into the app

The app currently reads the curated `src/data/curated.json`. To use pipeline
output, point [`../src/data/dataset.ts`](../src/data/dataset.ts) at the generated
file and extend `Lang`/`TIER` to cover any new language codes it emits.
