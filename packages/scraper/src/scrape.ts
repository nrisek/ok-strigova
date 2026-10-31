import { CLUB, SITES, competitionUrl, isClubTeam, matchUrl, teamUrl, type SiteConfig } from './config';
import { removeMirrors } from './dedupe';
import { Client, type ClientOptions } from './http';
import type { Competition, Match, SiteSource, Snapshot, Team } from './model';
import { slugify } from './parse/common';
import { parseCompetitionPage } from './parse/competition';
import { parseMatchPage } from './parse/match';
import { parseNav } from './parse/nav';
import { parseTeamPage } from './parse/team';
import { finalizeTeams } from './teams';

export interface ScrapeOptions extends ClientOptions {
  sites?: SiteConfig[];
  /** Dohvati i stranice pojedinih utakmica kluba (dvorana, suci, trajanje). */
  matchDetails?: boolean;
}

/** Cijeli postupak: izbornik → natjecanja → ekipe kluba → detalji utakmica kluba → dedup. */
export async function scrape(opts: ScrapeOptions = {}): Promise<Snapshot> {
  const log = opts.log ?? (() => {});
  const client = new Client(opts);
  const sites = opts.sites ?? SITES;

  const sources: SiteSource[] = [];
  let competitions: Competition[] = [];
  let matches: Match[] = [];
  const teams: Team[] = [];

  for (const site of sites) {
    const nav = parseNav(await client.get(`${site.baseUrl}/index.php`));
    sources.push({ id: site.id, name: site.name, baseUrl: site.baseUrl, lastChange: nav.lastChange });
    log(`[${site.id}] ${nav.competitions.length} natjecanja u izborniku`);

    const teamIds = new Map<number, Set<string>>();

    for (const entry of nav.competitions) {
      const html = await client.get(competitionUrl(site.baseUrl, entry.sourceId));
      const parsed = parseCompetitionPage(html, {
        site: site.id,
        sourceId: entry.sourceId,
        baseUrl: site.baseUrl,
        section: entry.section,
        isClubTeam,
      });
      if (parsed.competition.clubTeams.length === 0) {
        log(`[${site.id}] ${parsed.competition.name}: bez ekipa kluba, preskačem`);
        continue;
      }
      log(`[${site.id}] ${parsed.competition.name}: ${parsed.competition.clubTeams.join(', ')} (${parsed.matches.length} utakmica)`);
      competitions.push(parsed.competition);
      matches.push(...parsed.matches);

      for (const row of parsed.competition.groups.flatMap((g) => g.standings)) {
        if (!row.isClub || !row.teamSourceId) continue;
        let set = teamIds.get(row.teamSourceId);
        if (!set) teamIds.set(row.teamSourceId, (set = new Set()));
        set.add(parsed.competition.id);
      }
    }

    for (const [sourceId, competitionIds] of teamIds) {
      const info = parseTeamPage(await client.get(teamUrl(site.baseUrl, sourceId)));
      teams.push({
        id: `${site.id}-${sourceId}`,
        site: site.id,
        sourceId,
        url: teamUrl(site.baseUrl, sourceId),
        slug: slugify(info.name),
        ...info,
        competitionIds: [...competitionIds],
      });
    }
  }

  const deduped = removeMirrors(competitions, matches);
  competitions = deduped.competitions;
  matches = deduped.matches;
  for (const mirror of deduped.mirrors) log(`kopija: ${mirror.id} je isto što i ${mirror.mirrorOf}, uklonjeno`);

  if (opts.matchDetails ?? true) {
    const siteById = new Map(sites.map((s) => [s.id, s]));
    for (const match of matches) {
      if (match.clubTeams.length === 0 || match.status === 'bye' || match.status === 'tbd') continue;
      const site = siteById.get(match.site)!;
      const detail = parseMatchPage(await client.get(matchUrl(site.baseUrl, match.sourceId)));
      match.venue = detail.venue ?? match.venue;
      match.referees = detail.referees;
      match.durationMinutes = detail.durationMinutes;
      if (detail.startsAt) match.scheduledAt = detail.startsAt;
      if (match.sets.length === 0 && detail.sets.length) match.sets = detail.sets;
    }
  }

  const finalTeams = finalizeTeams(teams, competitions);
  matches.sort(compareMatches);
  log(`ukupno ${client.requests} HTTP zahtjeva`);

  return {
    generatedAt: new Date().toISOString(),
    club: { name: CLUB.name },
    sources,
    competitions,
    mirrors: deduped.mirrors,
    teams: finalTeams,
    matches,
  };
}

function compareMatches(a: Match, b: Match): number {
  const da = a.scheduledAt ?? a.roundDates[0] ?? '9999';
  const db = b.scheduledAt ?? b.roundDates[0] ?? '9999';
  return da.localeCompare(db) || a.competitionId.localeCompare(b.competitionId) || (a.number ?? 0) - (b.number ?? 0);
}
