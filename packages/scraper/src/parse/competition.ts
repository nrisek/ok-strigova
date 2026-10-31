import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { Competition, CompetitionGroup, Match, SetScore, SiteId, StandingRow } from '../model';
import { clean, findDates, idFromHref, parseDateTime, parseNumber, parseRatio, splitTitle } from './common';

export interface ParsedCompetition {
  competition: Competition;
  matches: Match[];
}

export interface CompetitionContext {
  site: SiteId;
  sourceId: number;
  baseUrl: string;
  section: string;
  isClubTeam: (name: string) => boolean;
}

const EN_DASH_SPLIT = /\s+[–-]\s+/u;

/**
 * Parsira stranicu natjecanja: poredak (po skupinama ako postoje) i sve utakmice po kolima.
 * Elementi se obilaze redom kako stoje u dokumentu, jer skupina, poredak i kola nisu
 * ugniježđeni nego se samo nižu jedan za drugim.
 */
export function parseCompetitionPage(html: string, ctx: CompetitionContext): ParsedCompetition {
  const $ = load(html);
  const id = `${ctx.site}-${ctx.sourceId}`;
  const { name, category } = splitTitle(($('title').text().split('|')[0] ?? '').trim());

  const groups: CompetitionGroup[] = [];
  const matches: Match[] = [];
  let pendingGroupName: string | null = null;
  let currentGroupName: string | null = null;
  let round: number | null = null;
  let roundDates: string[] = [];

  $('table.poredak, a[href*="kolo="], tr#utakmica, span').each((_, el) => {
    const node = $(el);
    const tag = el.tagName.toLowerCase();

    if (tag === 'span') {
      const own = ownText($, el);
      const m = own.match(/^SKUPINA\s+(.+)$/iu);
      if (m) {
        pendingGroupName = clean(m[1]);
        currentGroupName = pendingGroupName;
      }
      return;
    }

    if (tag === 'table') {
      groups.push({ name: pendingGroupName, standings: parseStandings($, node, ctx.isClubTeam) });
      pendingGroupName = null;
      return;
    }

    if (tag === 'a') {
      const text = clean(node.text());
      const m = text.match(/^(\d+)\.\s*kolo/u);
      if (!m) return;
      round = Number(m[1]);
      roundDates = findDates(clean(node.find('span.koloDatum').text()));
      return;
    }

    if (tag === 'tr') {
      const match = parseMatchRow($, node, { ...ctx, competitionId: id, group: currentGroupName, round, roundDates });
      if (match) matches.push(match);
    }
  });

  const clubTeams = uniqueSorted([
    ...groups.flatMap((g) => g.standings.filter((r) => r.isClub).map((r) => r.team)),
    ...matches.flatMap((m) => m.clubTeams),
  ]);

  return {
    competition: {
      id,
      site: ctx.site,
      sourceId: ctx.sourceId,
      url: `${ctx.baseUrl}/index.php?rubrika=utakmica&natjecanje=${ctx.sourceId}`,
      name,
      category,
      section: ctx.section,
      groups,
      clubTeams,
    },
    matches,
  };
}

function ownText($: CheerioAPI, el: Element): string {
  return clean(
    $(el)
      .contents()
      .filter((_, c) => c.type === 'text')
      .text(),
  );
}

function parseStandings($: CheerioAPI, table: Cheerio<Element>, isClubTeam: (n: string) => boolean): StandingRow[] {
  const rows: StandingRow[] = [];
  table.children('tbody, tr').children('tr').add(table.children('tr')).each((_, tr) => {
    const tds = $(tr).children('td');
    if (tds.length < 12) return;
    const rankText = clean(tds.eq(0).text());
    if (!/^\d+\.?$/.test(rankText)) return;
    const teamCell = tds.eq(1);
    const team = clean(teamCell.text());
    rows.push({
      rank: Number(rankText.replace('.', '')),
      team,
      teamSourceId: idFromHref(teamCell.find('a').attr('href')),
      played: parseNumber(tds.eq(2).text()),
      won: parseNumber(tds.eq(3).text()),
      lost: parseNumber(tds.eq(4).text()),
      setsWon: parseNumber(tds.eq(5).text()),
      setsLost: parseNumber(tds.eq(6).text()),
      setRatio: parseRatio(tds.eq(7).text()),
      pointsWon: parseNumber(tds.eq(8).text()),
      pointsLost: parseNumber(tds.eq(9).text()),
      pointRatio: parseRatio(tds.eq(10).text()),
      points: parseNumber(tds.eq(11).text()),
      isClub: isClubTeam(team),
    });
  });
  return rows;
}

interface RowContext extends CompetitionContext {
  competitionId: string;
  group: string | null;
  round: number | null;
  roundDates: string[];
}

function parseMatchRow($: CheerioAPI, tr: Cheerio<Element>, ctx: RowContext): Match | null {
  const tds = tr.children('td');
  if (tds.length < 3) return null;

  const sourceId = idFromHref(tds.eq(0).find('a').attr('href'));
  if (!sourceId) return null;

  const numberText = clean(tds.eq(0).text()).replace('.', '');
  const number = /^\d+$/.test(numberText) ? Number(numberText) : null;

  const teamsText = clean(tds.eq(1).text());
  const parts = teamsText.split(EN_DASH_SPLIT);
  if (parts.length < 2) return null;
  const home = clean(parts[0]);
  const away = clean(parts.slice(1).join(' – '));

  const resultCell = tds.eq(2);
  const setsText = clean(resultCell.find('span.setoviUzRezultat').text());
  const resultSpan = resultCell.find('span[class^="rezultat"]');
  const resultText = clean(resultSpan.length ? resultSpan.text() : resultCell.clone().find('span.setoviUzRezultat').remove().end().text());

  const base: Match = {
    id: `${ctx.site}-${sourceId}`,
    site: ctx.site,
    sourceId,
    url: `${ctx.baseUrl}/index.php?rubrika=utakmica&obrazac=1&id=${sourceId}`,
    competitionId: ctx.competitionId,
    group: ctx.group,
    round: ctx.round,
    roundDates: ctx.roundDates,
    number,
    home,
    away,
    status: 'tbd',
    result: null,
    sets: [],
    winner: null,
    scheduledAt: null,
    venue: null,
    referees: [],
    durationMinutes: null,
    note: null,
    clubTeams: [home, away].filter((t) => ctx.isClubTeam(t)),
  };

  if (home === '0' || away === '0') {
    return { ...base, status: 'bye' };
  }

  const score = resultText.match(/^(\d)\s*:\s*(\d)$/u);
  if (score) {
    const result: SetScore = { home: Number(score[1]), away: Number(score[2]) };
    return {
      ...base,
      status: 'played',
      result,
      sets: parseSets(setsText),
      winner: result.home === result.away ? null : result.home > result.away ? 'home' : 'away',
    };
  }

  if (/odgo[dđ]/iu.test(resultText)) {
    return { ...base, status: 'postponed', note: resultText };
  }

  const scheduledAt = parseDateTime(resultText);
  if (scheduledAt) {
    return { ...base, status: 'scheduled', scheduledAt };
  }

  const note = resultText && resultText !== '-' && !/nije određen/iu.test(resultText) ? resultText : null;
  return { ...base, status: 'tbd', note };
}

/** "(25:17,23:25,25:13,25:23)" → [{home:25,away:17}, …] */
export function parseSets(text: string): SetScore[] {
  const sets: SetScore[] = [];
  for (const m of text.matchAll(/(\d+)\s*:\s*(\d+)/g)) {
    sets.push({ home: Number(m[1]), away: Number(m[2]) });
  }
  return sets;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'hr'));
}
