import type { Lang } from "./schema.ts";

// Era "tier" of each language/stage. Used to decide which cognates count as
// "same level" as the focus word (e.g. all modern words share tier 3).
export const TIER: Record<Lang, number> = {
  pie: 0, // reconstructed root
  pgmc: 1,
  pira: 1,
  psl: 1, // proto stages
  ang: 2,
  goh: 2,
  peo: 2,
  pal: 2,
  la: 2,
  grc: 2,
  sa: 2, // ancient / old attested
  en: 3,
  de: 3,
  fa: 3,
  fr: 3,
  es: 3,
  it: 3,
  ru: 3,
  el: 3,
  hi: 3, // modern
};

/**
 * Tier of a language code, tolerant of codes the curated map doesn't list
 * (e.g. pipeline output: enm, fro, gmw, piir). Reconstructed proto-stages fall
 * to tier 1, PIE to 0, and anything else defaults to the ancient/medieval tier.
 */
export function tierOf(lang: string): number {
  const known = TIER[lang as Lang];
  if (known !== undefined) return known;
  if (lang === "pie" || lang === "ine-pro") return 0;
  if (lang.endsWith("-pro")) return 1;
  return 2;
}
