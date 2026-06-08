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

## Known limitations (the genuinely hard parts)

- **Reconstruction convergence.** A chain may end at an inflected root form
  (e.g. `*dʰwṓr`) rather than the lemma (`*dʰwer-`), so sibling branches don't
  always merge at one PIE node. A normalization/alias step is needed.
- **Competing etymologies.** Pages with `===Etymology 1===`/`2` or multiple
  senses can pull in unrelated forms (e.g. Persian اندر "within" under در). We
  currently take the first etymology and otherwise ignore the rest, by design.
- **Comma-batched cognates** (`{{cog|da,nb,nn|dør}}`) and unmapped language
  codes are skipped for now.
- **Transliteration.** Non-Latin terms keep their native script in `label`;
  `latin` is left null (a romanization step is still needed).

## Wiring into the app

The app currently reads the curated `src/data/curated.json`. To use pipeline
output, point [`../src/data/dataset.ts`](../src/data/dataset.ts) at the generated
file and extend `Lang`/`TIER` to cover any new language codes it emits.
