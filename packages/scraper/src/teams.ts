import type { Competition, Team } from './model';
import { slugify } from './parse/common';

/** "najmlađe kadetkinje U13" → "U13"; "seniorke" → "seniorke". */
export function shortCategory(category: string | null): string | null {
  if (!category) return null;
  const u = category.match(/\bU-?\s?(\d+)\b/iu);
  return u ? `U${u[1]}` : category;
}

const isSenior = (t: Team): boolean => /^senior/iu.test(t.category ?? '');

/**
 * Završna obrada ekipa:
 * - poveže ekipu i s natjecanjima bez tablice poretka (turniri) po imenu i kategoriji,
 * - ukloni ekipe čija su natjecanja uklonjena kao kopije,
 * - osigura jedinstvene slugove (seniorska ekipa zadržava čisti slug, ostale dobivaju kategoriju),
 * - poreda ekipe: seniorske prve, zatim po imenu.
 */
export function finalizeTeams(teams: Team[], competitions: Competition[]): Team[] {
  const known = new Set(competitions.map((c) => c.id));
  const out: Team[] = [];

  for (const team of teams) {
    const competitionIds = team.competitionIds.filter((id) => known.has(id));
    for (const c of competitions) {
      if (c.site !== team.site || competitionIds.includes(c.id) || !c.clubTeams.includes(team.name)) continue;
      if (c.category && team.category && c.category !== team.category) continue;
      competitionIds.push(c.id);
    }
    if (competitionIds.length) out.push({ ...team, competitionIds });
  }

  const byName = new Map<string, Team[]>();
  for (const t of out) byName.set(t.name, [...(byName.get(t.name) ?? []), t]);
  for (const group of byName.values()) {
    const plain = group.length === 1 ? group[0] : group.find(isSenior);
    for (const t of group) {
      t.slug = t === plain ? slugify(t.name) : slugify(`${t.name} ${shortCategory(t.category) ?? t.site}`);
    }
  }
  const seen = new Set<string>();
  for (const t of out) {
    if (seen.has(t.slug)) t.slug = `${t.slug}-${t.site}`;
    seen.add(t.slug);
  }

  const collator = new Intl.Collator('hr', { numeric: true });
  return out.sort((a, b) => Number(isSenior(b)) - Number(isSenior(a)) || collator.compare(a.name, b.name));
}
