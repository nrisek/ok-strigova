import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isClubTeam } from '../src/config';
import { removeMirrors } from '../src/dedupe';
import { findDates, parseDateTime, slugify, splitTitle } from '../src/parse/common';
import { parseCompetitionPage } from '../src/parse/competition';
import { parseMatchPage } from '../src/parse/match';
import { parseNav } from '../src/parse/nav';
import { parseTeamPage } from '../src/parse/team';
import { finalizeTeams, shortCategory } from '../src/teams';

const fixture = (name: string): string => readFileSync(resolve(__dirname, '../fixtures', name), 'utf8');
const ctx = (sourceId: number, site: 'osvz' | 'osmz' = 'osvz') => ({
  site,
  sourceId,
  baseUrl: site === 'osvz' ? 'https://osvz.hr' : 'https://www.osmz.hr',
  section: 'Natjecanja',
  isClubTeam,
});

describe('common', () => {
  it('parses Croatian dates and times', () => {
    expect(findDates('(3. listopada 2026., 4. listopada 2026.)')).toEqual(['2026-10-03', '2026-10-04']);
    expect(parseDateTime('nedjelja, 4. listopada 2026. u 17,00')).toBe('2026-10-04T17:00');
    expect(parseDateTime('četvrtak, 5. studenog 2026. u 9,05')).toBe('2026-11-05T09:05');
    expect(parseDateTime('18. listopada 2026.')).toBe('2026-10-18');
    expect(parseDateTime('termin nije određen')).toBeNull();
  });
  it('splits competition titles and slugifies', () => {
    expect(splitTitle('3. HRVATSKA ODBOJKAŠKA LIGA SJEVER - skupina Sjever  – seniorke')).toEqual({
      name: '3. HRVATSKA ODBOJKAŠKA LIGA SJEVER - skupina Sjever',
      category: 'seniorke',
    });
    expect(slugify('OK Štrigova 2')).toBe('ok-strigova-2');
    expect(slugify('Đurđevac Čakovec')).toBe('durdevac-cakovec');
  });
  it('recognises club teams', () => {
    expect(isClubTeam('OK Štrigova')).toBe(true);
    expect(isClubTeam('OK Štrigova 3')).toBe(true);
    expect(isClubTeam('ŽOK Kaštel 2')).toBe(false);
  });
});

describe('nav', () => {
  it('lists competitions with their sections', () => {
    const nav = parseNav(fixture('osvz-home-nav.html'));
    expect(nav.competitions.map((c) => c.sourceId)).toEqual([152, 154, 150, 155, 161, 159, 162]);
    expect(nav.competitions[0]?.section).toBe('Natjecanja');
    expect(nav.competitions[3]?.section).toBe('MLAĐE dobne kategorije');
    expect(nav.lastChange).toBe('29. listopada 2026., 10,07');
  });
});

describe('competition page', () => {
  const { competition, matches } = parseCompetitionPage(fixture('osvz-competition-152.html'), ctx(152));

  it('reads the title and standings', () => {
    expect(competition.name).toBe('3. HRVATSKA ODBOJKAŠKA LIGA SJEVER - skupina Sjever');
    expect(competition.category).toBe('seniorke');
    expect(competition.groups).toHaveLength(1);
    const standings = competition.groups[0]!.standings;
    expect(standings).toHaveLength(13);
    expect(standings[0]).toMatchObject({ rank: 1, team: 'OK Nedelišće Elting 2', teamSourceId: 6, played: 4, won: 3, lost: 1, setsWon: 11, setsLost: 3, setRatio: 3.6667, points: 10 });
    const club = standings.find((r) => r.isClub);
    expect(club).toMatchObject({ rank: 7, team: 'OK Štrigova', teamSourceId: 94, points: 6, pointsWon: 347, pointsLost: 354 });
    expect(competition.clubTeams).toEqual(['OK Štrigova']);
  });

  it('reads all rounds and match states', () => {
    expect(matches).toHaveLength(26 * 7);
    const played = matches.find((m) => m.sourceId === 4460)!;
    expect(played).toMatchObject({
      round: 1,
      roundDates: ['2026-10-03', '2026-10-04'],
      number: 5,
      home: 'OK Štrigova',
      away: 'ŽOK Ivanec 2',
      status: 'played',
      result: { home: 3, away: 1 },
      winner: 'home',
      clubTeams: ['OK Štrigova'],
    });
    expect(played.sets).toEqual([
      { home: 25, away: 17 },
      { home: 23, away: 25 },
      { home: 25, away: 13 },
      { home: 25, away: 23 },
    ]);
    expect(matches.find((m) => m.number === 14)).toMatchObject({ status: 'postponed', home: 'ŽOK Ludbreg', away: 'OK Bedex 2' });
    expect(matches.find((m) => m.number === 30)).toMatchObject({ status: 'scheduled', scheduledAt: '2026-11-05T17:00' });
    expect(matches.find((m) => m.number === 31)).toMatchObject({ status: 'tbd', home: 'OK Štrigova', away: 'ŽOK Ludbreg', round: 5 });
    expect(matches.find((m) => m.number === 1)).toMatchObject({ status: 'bye', home: 'ŽOK Ludbreg', away: '0' });
    expect(matches.filter((m) => m.clubTeams.length)).toHaveLength(26);
  });

  it('handles groups', () => {
    const { competition: c, matches: ms } = parseCompetitionPage(fixture('osvz-competition-155-groups.html'), ctx(155));
    expect(c.groups.map((g) => g.name)).toEqual(['A', 'B', 'C']);
    expect(c.groups[0]!.standings).toHaveLength(6);
    expect(c.groups[1]!.standings).toHaveLength(5);
    expect(ms.filter((m) => m.group === 'A')).toHaveLength(15);
    expect(ms.find((m) => m.group === 'A' && m.number === 10)).toMatchObject({ status: 'scheduled', scheduledAt: '2026-11-15T09:50', away: 'OK Štrigova' });
    expect(ms.filter((m) => m.group === 'B').length).toBeGreaterThan(0);
  });

  it('handles a tournament without standings', () => {
    const { competition: c, matches: ms } = parseCompetitionPage(fixture('osvz-competition-150-tournament.html'), ctx(150));
    expect(c.groups).toHaveLength(0);
    expect(ms).toHaveLength(10);
    expect(c.clubTeams).toEqual(['OK Štrigova']);
  });

  it('finds several club teams on the Međimurje site', () => {
    const { competition: c } = parseCompetitionPage(fixture('osmz-competition-22.html'), ctx(22, 'osmz'));
    expect(c.id).toBe('osmz-22');
    expect(c.clubTeams).toEqual(['OK Štrigova 2', 'OK Štrigova 3']);
  });
});

describe('team page', () => {
  it('reads team metadata', () => {
    expect(parseTeamPage(fixture('osvz-team-94.html'))).toEqual({
      name: 'OK Štrigova',
      club: 'OK Štrigova',
      hall: 'Dvorana OŠ Štrigova',
      category: 'seniorke',
      gender: 'žene',
      contact: 'Siniša Stanković',
    });
  });
});

describe('match page', () => {
  it('reads a played match', () => {
    expect(parseMatchPage(fixture('osvz-match-4460.html'))).toEqual({
      home: 'OK Štrigova',
      away: 'ŽOK Ivanec 2',
      sets: [
        { home: 25, away: 17 },
        { home: 23, away: 25 },
        { home: 25, away: 13 },
        { home: 25, away: 23 },
      ],
      startsAt: '2026-10-04T17:00',
      venue: 'Dvorana OŠ Štrigova',
      referees: ['Miroslav Vabec', 'Emili Puklavec'],
      durationMinutes: 106,
      homeJersey: 'crno - plava',
      number: 5,
    });
  });
  it('reads a scheduled match without details', () => {
    expect(parseMatchPage(fixture('osvz-match-4637-scheduled.html'))).toMatchObject({
      home: 'ŽOK Ludbreg',
      away: 'OK Nedelišće Elting 2',
      sets: [],
      startsAt: null,
      venue: null,
      referees: [],
      number: 182,
    });
  });
});

describe('dedupe', () => {
  it('removes a competition mirrored on the other site', () => {
    const a = parseCompetitionPage(fixture('osvz-competition-155-groups.html'), ctx(155));
    // Simuliraj OSMŽ kopiju: iste utakmice skupine A pod drugim id-em i savezom.
    const bMatches = a.matches
      .filter((m) => m.group === 'A')
      .map((m) => ({ ...m, id: m.id.replace('osvz', 'osmz'), site: 'osmz' as const, competitionId: 'osmz-23', group: null }));
    const b = { ...a.competition, id: 'osmz-23', site: 'osmz' as const, groups: [a.competition.groups[0]!] };
    const result = removeMirrors([a.competition, b], [...a.matches, ...bMatches]);
    expect(result.competitions.map((c) => c.id)).toEqual(['osvz-155']);
    expect(result.mirrors).toEqual([{ id: 'osmz-23', url: b.url, name: b.name, mirrorOf: 'osvz-155' }]);
    expect(result.matches).toHaveLength(a.matches.length);
  });
});

describe('teams', () => {
  it('links tournaments by category, drops orphans, and keeps slugs unique', () => {
    const comps = [
      { id: 'osvz-152', site: 'osvz', category: 'seniorke', clubTeams: ['OK Štrigova'] },
      { id: 'osvz-150', site: 'osvz', category: 'seniorke', clubTeams: ['OK Štrigova'], groups: [] },
      { id: 'osvz-155', site: 'osvz', category: 'najmlađe kadetkinje U13', clubTeams: ['OK Štrigova'] },
      { id: 'osmz-22', site: 'osmz', category: 'seniorke', clubTeams: ['OK Štrigova 2', 'OK Štrigova 3'] },
    ] as unknown as Parameters<typeof finalizeTeams>[1];
    const team = (id: string, name: string, category: string, competitionIds: string[]) =>
      ({ id, site: id.split('-')[0], name, category, competitionIds, slug: '' }) as unknown as Parameters<typeof finalizeTeams>[0][number];
    const result = finalizeTeams(
      [
        team('osvz-63', 'OK Štrigova', 'najmlađe kadetkinje U13', ['osvz-155']),
        team('osvz-94', 'OK Štrigova', 'seniorke', ['osvz-152']),
        team('osmz-51', 'OK Štrigova 3', 'seniorke', ['osmz-22']),
        team('osmz-10', 'OK Štrigova 2', 'seniorke', ['osmz-22']),
        team('osmz-15', 'OK Štrigova', 'najmlađe kadetkinje U13', ['osmz-23']),
      ],
      comps,
    );
    expect(result.map((t) => [t.id, t.slug, t.competitionIds])).toEqual([
      ['osvz-94', 'ok-strigova', ['osvz-152', 'osvz-150']],
      ['osmz-10', 'ok-strigova-2', ['osmz-22']],
      ['osmz-51', 'ok-strigova-3', ['osmz-22']],
      ['osvz-63', 'ok-strigova-u13', ['osvz-155']],
    ]);
    expect(shortCategory('najmlađe kadetkinje U13')).toBe('U13');
    expect(shortCategory('seniorke')).toBe('seniorke');
  });
});
