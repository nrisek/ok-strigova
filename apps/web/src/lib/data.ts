import type { Competition, CompetitionGroup, Match, Snapshot, StandingRow, Team } from '@ok-strigova/scraper/model';
import { shortCategory } from '@ok-strigova/scraper/teams';
import snapshotJson from '../../../../data/snapshot.json';

export const snapshot = snapshotJson as unknown as Snapshot;
export const club = snapshot.club;
export const competitions: Competition[] = snapshot.competitions;
export const teams: Team[] = snapshot.teams;
export const matches: Match[] = snapshot.matches;

export const competitionsById = new Map(competitions.map((c) => [c.id, c] as const));
export const teamsBySlug = new Map(teams.map((t) => [t.slug, t] as const));

/** Utakmice u kojima igra barem jedna ekipa kluba. */
export const clubMatches = matches.filter((m) => m.clubTeams.length > 0);

/** Današnji datum (YYYY-MM-DD) u Zagrebu u trenutku izgradnje stranice. */
export const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb' }).format(new Date());

export function sortKey(m: Match): string {
  return m.scheduledAt ?? m.roundDates[0] ?? '9999-12-31';
}

function lastDay(m: Match): string {
  return (m.scheduledAt ?? m.roundDates[m.roundDates.length - 1] ?? '9999-12-31').slice(0, 10);
}

export function byDateAsc(a: Match, b: Match): number {
  return (
    sortKey(a).localeCompare(sortKey(b)) ||
    a.competitionId.localeCompare(b.competitionId) ||
    (a.number ?? 0) - (b.number ?? 0)
  );
}

export function byDateDesc(a: Match, b: Match): number {
  return byDateAsc(b, a);
}

export function isUpcoming(m: Match): boolean {
  return m.status !== 'played' && m.status !== 'bye' && lastDay(m) >= today;
}

export const upcoming = clubMatches.filter(isUpcoming).sort(byDateAsc);
export const results = clubMatches.filter((m) => m.status === 'played').sort(byDateDesc);

/** Ekipa kluba koja u toj utakmici nastupa pod tim imenom (ime se može ponavljati u različitim kategorijama). */
export function teamFor(m: Match, name: string): Team | undefined {
  return teams.find((t) => t.site === m.site && t.name === name && t.competitionIds.includes(m.competitionId));
}

export function clubTeamsOf(m: Match): Team[] {
  return m.clubTeams.map((n) => teamFor(m, n)).filter((t): t is Team => t !== undefined);
}

export function matchesOf(team: Team): Match[] {
  return clubMatches
    .filter(
      (m) =>
        m.site === team.site &&
        team.competitionIds.includes(m.competitionId) &&
        (m.home === team.name || m.away === team.name),
    )
    .sort(byDateAsc);
}

/** Ishod iz perspektive kluba; međusobni dvoboji dviju ekipa kluba su neutralni. */
export function clubOutcome(m: Match): 'win' | 'loss' | null {
  if (m.status !== 'played' || !m.winner || m.clubTeams.length !== 1) return null;
  const winnerName = m.winner === 'home' ? m.home : m.away;
  return m.clubTeams.includes(winnerName) ? 'win' : 'loss';
}

export function standingOf(team: Team, c: Competition): { row: StandingRow; group: CompetitionGroup } | null {
  for (const group of c.groups) {
    const row = group.standings.find((r) => r.team === team.name);
    if (row) return { row, group };
  }
  return null;
}

const isSeniorCategory = (category: string | null): boolean => /^senior/iu.test(category ?? '');

/** "OK Štrigova", "OK Štrigova 2", "OK Štrigova U13". */
export function teamLabel(team: Team): string {
  const sameName = teams.filter((t) => t.name === team.name).length > 1;
  const cat = shortCategory(team.category);
  return sameName && cat && !isSeniorCategory(cat) ? `${team.name} ${cat}` : team.name;
}

/** Kratka oznaka bez "OK": "Štrigova", "Štrigova 2", "Štrigova U13". */
export function teamShort(team: Team): string {
  return teamLabel(team).replace(/^OK\s+/iu, '');
}

/** "3. HRVATSKA ODBOJKAŠKA LIGA SJEVER - skupina Sjever" → "3. HOL Sjever - skupina Sjever". Kratice do 3 slova (HOL, ŽOK) ostaju. */
export function competitionShortName(c: Competition): string {
  return c.name
    .replace(/\b[A-ZČĆŽŠĐ]{4,}\b/gu, (w) => w[0] + w.slice(1).toLowerCase())
    .replace(/Hrvatska Odbojkaška Liga/iu, 'HOL');
}

export function competitionFor(id: string): Competition | undefined {
  return competitionsById.get(id);
}

/** Boje ekipa kluba, redom kako su ekipe poredane (seniorke prve). Tekst mora biti čitljiv na tamnoj podlozi. */
const TEAM_PALETTE = ['#4fc3f7', '#ff8a65', '#69f0ae', '#b388ff', '#ffd166', '#f48fb1'];

export function teamColor(team: Team): string {
  const index = teams.indexOf(team);
  return TEAM_PALETTE[(index >= 0 ? index : 0) % TEAM_PALETTE.length]!;
}

/** Ekipa kluba u tablici poretka danog natjecanja, ako je redak ekipa kluba. */
export function teamInStandings(competition: Competition, teamName: string): Team | undefined {
  return teams.find((t) => t.site === competition.site && t.name === teamName && t.competitionIds.includes(competition.id));
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Ponedjeljak tjedna u kojem je datum (ISO). */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  return addDays(date, -offset);
}

export interface WeekGroup {
  start: string;
  end: string;
  matches: Match[];
}

/** Grupira utakmice po tjednima (pon–ned), zadržavajući redoslijed ulaznog popisa. */
export function groupByWeek(list: Match[]): WeekGroup[] {
  const groups = new Map<string, WeekGroup>();
  for (const m of list) {
    const start = weekStartOf(sortKey(m).slice(0, 10));
    let group = groups.get(start);
    if (!group) groups.set(start, (group = { start, end: addDays(start, 6), matches: [] }));
    group.matches.push(m);
  }
  return [...groups.values()];
}

/** Hrvatska množina: plural(3, 'bod', 'boda', 'bodova') → "3 boda". */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${n} ${word}`;
}

/** Putanja s obzirom na `base` iz astro.config (GitHub Pages servira stranicu iz potputanje). */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/u, '');
  const joined = `${base}/${path.replace(/^\//u, '')}`;
  return joined.length > 1 ? joined.replace(/\/$/u, '') : joined;
}
