// Wiktionary etymology pipeline (first working version).
//
//   npm run ingest -- door father three > ingestion/out.json
//
// For each seed English word it fetches the page wikitext from the live
// MediaWiki API, parses the Etymology section's templates ({{inh}}, {{der}},
// {{bor}}, {{cog}}, {{root}}) into the same `Dataset` shape as
// src/data/curated.json, and recurses one level on cognates so each cognate
// gets its own ancestor chain up to the shared root.
//
// This is a real but deliberately small extractor: it handles the common
// template forms and the languages we map below. Messy cases (multiple
// competing etymologies, comma-batched cognates, non-matching reconstruction
// spellings) are skipped or noted rather than guessed — see the TODOs.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Dataset, Edge, WordNode } from "../src/data/schema.ts";

const API = "https://en.wiktionary.org/w/api.php";
const USER_AGENT = "etymology-tree-prototype/0.1 (educational; contact: local dev)";

// Wiktionary language code -> how we present it. tier mirrors src/data/tiers.ts
// (0 = PIE, 1 = proto, 2 = ancient/medieval, 3 = modern).
interface LangInfo {
  code: string;
  label: string;
  tier: number;
}
const LANGS: Record<string, LangInfo> = {
  en: { code: "en", label: "English", tier: 3 },
  de: { code: "de", label: "German", tier: 3 },
  fa: { code: "fa", label: "Persian", tier: 3 },
  fr: { code: "fr", label: "French", tier: 3 },
  es: { code: "es", label: "Spanish", tier: 3 },
  it: { code: "it", label: "Italian", tier: 3 },
  ru: { code: "ru", label: "Russian", tier: 3 },
  el: { code: "el", label: "Modern Greek", tier: 3 },
  hi: { code: "hi", label: "Hindi", tier: 3 },
  la: { code: "la", label: "Latin", tier: 2 },
  grc: { code: "grc", label: "Ancient Greek", tier: 2 },
  sa: { code: "sa", label: "Sanskrit", tier: 2 },
  ang: { code: "ang", label: "Old English", tier: 2 },
  enm: { code: "enm", label: "Middle English", tier: 2 },
  goh: { code: "goh", label: "Old High German", tier: 2 },
  pal: { code: "pal", label: "Middle Persian", tier: 2 },
  peo: { code: "peo", label: "Old Persian", tier: 2 },
  "gem-pro": { code: "pgmc", label: "Proto-Germanic", tier: 1 },
  "gmw-pro": { code: "gmw", label: "Proto-West Germanic", tier: 1 },
  "ira-pro": { code: "pira", label: "Proto-Iranian", tier: 1 },
  "iir-pro": { code: "piir", label: "Proto-Indo-Iranian", tier: 1 },
  "sla-pro": { code: "psl", label: "Proto-Slavic", tier: 1 },
  "itc-pro": { code: "pitc", label: "Proto-Italic", tier: 1 },
  "ine-pro": { code: "pie", label: "Proto-Indo-European", tier: 0 },
};

// Languages we follow when recursing on a cognate to build its own chain.
const COGNATE_TARGETS = new Set(["de", "fa", "fr", "es", "it", "ru", "el", "hi", "la", "grc", "sa"]);

function langInfo(wikiCode: string): LangInfo {
  return LANGS[wikiCode] ?? { code: wikiCode, label: wikiCode, tier: 2 };
}

// Resilient fetch: serves from an on-disk cache when present (so re-runs are
// instant and don't hit the rate limit), otherwise paces requests, backs off on
// 429 (honoring Retry-After), and returns "" rather than throwing so a single
// failure doesn't lose the whole run.
async function fetchWikitext(title: string): Promise<string> {
  const cached = readCache(title);
  if (cached !== null) return cached;
  const text = await fetchWikitextUncached(title);
  if (text) writeCache(title, text);
  return text;
}

async function fetchWikitextUncached(title: string): Promise<string> {
  const url = `${API}?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(
    title
  )}&format=json&formatversion=2&maxlag=5`;
  for (let attempt = 0; attempt < 6; attempt++) {
    await delay(REQUEST_DELAY_MS);
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      const data = await res.json();
      return data?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content ?? "";
    }
    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get("retry-after")) * 1000;
      const wait = retryAfter || 1500 * 2 ** attempt;
      console.error(`  throttled (${res.status}) on "${title}", waiting ${wait}ms`);
      await delay(wait);
      continue;
    }
    console.error(`  ! API ${res.status} for "${title}" — skipping`);
    return "";
  }
  console.error(`  ! gave up on "${title}" — skipping`);
  return "";
}

const REQUEST_DELAY_MS = 1100;
const MAX_COGNATES_PER_SEED = 8;

// Tiny on-disk cache of fetched wikitext, keyed by page title.
const CACHE_DIR = "ingestion/.cache";
function cachePath(title: string): string {
  return `${CACHE_DIR}/${encodeURIComponent(title)}.wiki`;
}
function readCache(title: string): string | null {
  const path = cachePath(title);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}
function writeCache(title: string, text: string): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(title), text, "utf8");
}

/** Pull the first Etymology section's wikitext from a given ==Language== block. */
function extractEtymology(wikitext: string, wikiLangName: string): string {
  const lang = section(wikitext, 2, wikiLangName);
  if (!lang) return "";
  // Either "===Etymology===" or "===Etymology 1===".
  const m = lang.match(/===\s*Etymology(?:\s*\d+)?\s*===\s*([\s\S]*?)(?=\n===[^=]|\n==[^=]|$)/);
  return m ? m[1] : "";
}

/** Return the body of the first heading of `level` whose title matches `name`. */
function section(wikitext: string, level: number, name: string): string | null {
  const eq = "=".repeat(level);
  // (?:^|\n) so it matches even when the section is the very first line (pages
  // with no {{also}} hatnote, e.g. Latin-only "foris").
  const re = new RegExp(`(?:^|\\n)${eq}\\s*${name}\\s*${eq}\\s*([\\s\\S]*?)(?=\\n${eq}[^=]|\\n={1,${level}}[^=]|$)`);
  const m = wikitext.match(re);
  return m ? m[1] : null;
}

/** Parse {{a|b|c|...}} template invocations into arrays of their params. */
function templates(text: string, names: Set<string>): string[][] {
  const out: string[][] = [];
  const re = /\{\{([^{}]*)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const parts = m[1].split("|").map((p) => p.trim());
    if (names.has(parts[0])) out.push(parts);
  }
  return out;
}

/** Strip named params (a=b) and Wiktionary gloss markers from a term param. */
function cleanTerm(raw: string | undefined): string {
  if (!raw || raw === "-" || raw.includes("=")) return "";
  return raw.replace(/^\*/, "").trim();
}

interface Parsed {
  nodes: Map<string, WordNode>;
  edges: Edge[];
}

function nodeId(lang: LangInfo, term: string): string {
  return `${lang.code}-${slug(term)}`;
}
function slug(term: string): string {
  return (
    term
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "x"
  );
}

function upsert(p: Parsed, lang: LangInfo, term: string): WordNode {
  const id = nodeId(lang, term);
  let n = p.nodes.get(id);
  if (!n) {
    n = { id, label: term, latin: null, lang: lang.code as WordNode["lang"], langLabel: lang.label };
    p.nodes.set(id, n);
  }
  return n;
}

/** The canonical PIE root lemma from {{root|<lang>|ine-pro|*term}}, if present. */
function parseRoot(etymText: string): string | null {
  for (const t of templates(etymText, new Set(["root"]))) {
    const i = t.findIndex((p, idx) => idx >= 2 && p === "ine-pro");
    const term = cleanTerm(t[i + 1]);
    if (i >= 0 && term) return term;
  }
  return null;
}

/**
 * Walk the inheritance chain in `etymText`. The {{inh|der|bor}} templates list
 * successive ancestors of `pageLang:pageTerm`; we wire each consecutive pair as
 * a child -> parent edge. The chain's own PIE lemma is kept as a node (e.g.
 * *ph₂tḗr, *dʰwṓr) and linked up to the deep canonical root from {{root}} (e.g.
 * *peh₂-, *dʰwer-), so sibling branches converge on the shared root without the
 * noun lemma being collapsed into the verbal root.
 */
function parseChain(
  p: Parsed,
  etymText: string,
  pageLang: LangInfo,
  pageTerm: string,
  canonicalRoot: string | null
): void {
  const steps = templates(etymText, new Set(["inh", "der", "bor"]));
  const chain: WordNode[] = [upsert(p, pageLang, pageTerm)];
  for (const t of steps) {
    const ancestorLang = langInfo(t[2]);
    const term = cleanTerm(t[3]);
    if (!term) continue;
    const node = upsert(p, ancestorLang, term);
    const child = chain[chain.length - 1];
    if (child.id !== node.id) {
      p.edges.push({ from: child.id, to: node.id, type: edgeType(t[0], ancestorLang.tier) });
    }
    chain.push(node);
    // The inheritance chain to PIE ends here; further {{inh}} in the same
    // section belong to a different sense (e.g. "mother" = dregs -> *muþraz).
    if (ancestorLang.tier === 0) break;
  }
  // Link the chain's top up to the deep canonical root (unless it is already it).
  if (canonicalRoot) {
    const root = upsert(p, langInfo("ine-pro"), canonicalRoot);
    const top = chain[chain.length - 1];
    if (top.id !== root.id) p.edges.push({ from: top.id, to: root.id, type: "root" });
  }
}

function edgeType(template: string, parentTier: number): Edge["type"] {
  if (template === "bor") return "borrowed";
  if (parentTier === 0) return "root";
  return "inherited";
}

/**
 * {{cog|LANG|TERM}} cognates in our target languages. Multiword terms are
 * dropped — they are almost always figurative compounds from an unrelated sense
 * (e.g. "mère de vinaigre" under "mother"), not true single-word cognates.
 */
function parseCognates(etymText: string): { lang: LangInfo; term: string }[] {
  return templates(etymText, new Set(["cog", "cognate"]))
    .filter((t) => COGNATE_TARGETS.has(t[1])) // skip comma-batched / unmapped langs
    .map((t) => ({ lang: langInfo(t[1]), term: cleanTerm(t[2]) }))
    .filter((c) => c.term && !c.term.includes(" "));
}

async function buildDataset(seeds: string[]): Promise<Dataset> {
  const p: Parsed = { nodes: new Map(), edges: [] };
  for (const seed of seeds) {
    const wikitext = await fetchWikitext(seed);
    const etym = extractEtymology(wikitext, "English");
    if (!etym) {
      console.error(`! no English etymology for "${seed}"`);
      continue;
    }
    const root = parseRoot(etym);
    parseChain(p, etym, langInfo("en"), seed, root);

    // Recurse one level on cognates so each gets its own ancestor chain, made to
    // converge on this root. Capped per seed to keep the request volume polite.
    for (const cog of parseCognates(etym).slice(0, MAX_COGNATES_PER_SEED)) {
      const cogText = extractEtymology(await fetchWikitext(cog.term), wikiLangName(cog.lang.code));
      if (cogText) parseChain(p, cogText, cog.lang, cog.term, parseRoot(cogText) ?? root);
      else upsert(p, cog.lang, cog.term); // at least keep the cognate node
    }
  }
  // Drop dangling edges and de-duplicate (branches share ancestors).
  const ids = new Set(p.nodes.keys());
  const seen = new Set<string>();
  const edges = p.edges.filter((e) => {
    const key = `${e.from}|${e.to}|${e.type}`;
    if (!ids.has(e.from) || !ids.has(e.to) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { nodes: [...p.nodes.values()], edges };
}

// Map our display code back to the Wiktionary ==Language== header name.
function wikiLangName(code: string): string {
  const hit = Object.values(LANGS).find((l) => l.code === code);
  return hit ? hit.label.replace("Modern Greek", "Greek") : code;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const seeds = process.argv.slice(2);
  if (seeds.length === 0) {
    console.error("usage: npm run ingest -- <word> [word ...]");
    process.exit(1);
  }
  const dataset = await buildDataset(seeds);
  console.error(`✓ ${dataset.nodes.length} nodes, ${dataset.edges.length} edges from ${seeds.length} seed(s)`);
  process.stdout.write(JSON.stringify(dataset, null, 2));
}

main();
