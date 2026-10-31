import type { Competition, Match, MirroredCompetition } from './model';

const normalize = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();

function matchKey(m: Match): string {
  const result = m.result ? `${m.result.home}:${m.result.away}` : '';
  const sets = m.sets.map((s) => `${s.home}-${s.away}`).join(',');
  return [normalize(m.home), normalize(m.away), m.round ?? '', m.number ?? '', result, sets, m.scheduledAt ?? ''].join('|');
}

/**
 * Oba saveza ponekad objave isto natjecanje (npr. U13 skupina). Natjecanje čije se utakmice
 * gotovo u cijelosti nalaze u nekom natjecanju s drugog saveza označava se kao kopija i uklanja,
 * zajedno sa svojim utakmicama.
 */
export function removeMirrors(
  competitions: Competition[],
  matches: Match[],
  threshold = 0.9,
): { competitions: Competition[]; matches: Match[]; mirrors: MirroredCompetition[] } {
  const keysByCompetition = new Map<string, Set<string>>();
  for (const m of matches) {
    if (m.status === 'bye') continue;
    let keys = keysByCompetition.get(m.competitionId);
    if (!keys) keysByCompetition.set(m.competitionId, (keys = new Set()));
    keys.add(matchKey(m));
  }

  const mirrorOf = new Map<string, string>();
  for (const canonical of competitions) {
    if (mirrorOf.has(canonical.id)) continue;
    const canonicalKeys = keysByCompetition.get(canonical.id) ?? new Set<string>();
    for (const candidate of competitions) {
      if (candidate.id === canonical.id || candidate.site === canonical.site || mirrorOf.has(candidate.id)) continue;
      const candidateKeys = keysByCompetition.get(candidate.id) ?? new Set<string>();
      if (candidateKeys.size === 0 || candidateKeys.size > canonicalKeys.size) continue;
      let overlap = 0;
      for (const k of candidateKeys) if (canonicalKeys.has(k)) overlap++;
      if (overlap / candidateKeys.size >= threshold) mirrorOf.set(candidate.id, canonical.id);
    }
  }

  const mirrors: MirroredCompetition[] = competitions
    .filter((c) => mirrorOf.has(c.id))
    .map((c) => ({ id: c.id, url: c.url, name: c.name, mirrorOf: mirrorOf.get(c.id)! }));

  return {
    competitions: competitions.filter((c) => !mirrorOf.has(c.id)),
    matches: matches.filter((m) => !mirrorOf.has(m.competitionId)),
    mirrors,
  };
}
