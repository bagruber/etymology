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
