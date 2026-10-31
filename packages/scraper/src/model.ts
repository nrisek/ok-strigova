/** Izvor podataka: županijski odbojkaški savez. */
export type SiteId = 'osvz' | 'osmz';

export interface SiteSource {
  id: SiteId;
  name: string;
  baseUrl: string;
  /** Tekst iz podnožja stranice, npr. "29. listopada 2026., 10,07". */
  lastChange: string | null;
}

export type MatchStatus = 'played' | 'scheduled' | 'tbd' | 'postponed' | 'bye';

export interface SetScore {
  home: number;
  away: number;
}

export interface Match {
  /** `${site}-${sourceId}` */
  id: string;
  site: SiteId;
  sourceId: number;
  url: string;
  competitionId: string;
  group: string | null;
  round: number | null;
  /** Datumi kola (ISO), obično vikend: ["2026-10-03", "2026-10-04"]. */
  roundDates: string[];
  number: number | null;
  home: string;
  away: string;
  status: MatchStatus;
  /** Osvojeni setovi, npr. 3:1. */
  result: SetScore | null;
  sets: SetScore[];
  winner: 'home' | 'away' | null;
  /** Lokalno vrijeme (Europe/Zagreb) bez zone, npr. "2026-10-04T17:00" ili "2026-11-15". */
  scheduledAt: string | null;
  venue: string | null;
  referees: string[];
  durationMinutes: number | null;
  /** Sirovi tekst iz stupca rezultata kad nije ni rezultat ni datum (npr. "odgođeno"). */
  note: string | null;
  /** Imena ekipa kluba koje igraju ovu utakmicu (0, 1 ili 2). */
  clubTeams: string[];
}

export interface StandingRow {
  rank: number;
  team: string;
  teamSourceId: number | null;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  /** null kad je omjer beskonačan (0 izgubljenih). */
  setRatio: number | null;
  pointsWon: number;
  pointsLost: number;
  pointRatio: number | null;
  points: number;
  isClub: boolean;
}

export interface CompetitionGroup {
  /** npr. "A" za "SKUPINA A"; null kad natjecanje nema skupine. */
  name: string | null;
  standings: StandingRow[];
}

export interface Competition {
  /** `${site}-${sourceId}` */
  id: string;
  site: SiteId;
  sourceId: number;
  url: string;
  /** npr. "3. HRVATSKA ODBOJKAŠKA LIGA SJEVER - skupina Sjever" */
  name: string;
  /** npr. "seniorke", "najmlađe kadetkinje U13" */
  category: string | null;
  /** Naslov izbornika na stranici saveza, npr. "MLAĐE dobne kategorije". */
  section: string;
  groups: CompetitionGroup[];
  clubTeams: string[];
}

export interface MirroredCompetition {
  id: string;
  url: string;
  name: string;
  /** Natjecanje s drugog saveza koje sadrži iste utakmice. */
  mirrorOf: string;
}

export interface Team {
  /** `${site}-${sourceId}` */
  id: string;
  site: SiteId;
  sourceId: number;
  url: string;
  slug: string;
  name: string;
  club: string | null;
  hall: string | null;
  category: string | null;
  gender: string | null;
  contact: string | null;
  competitionIds: string[];
}

export interface Snapshot {
  generatedAt: string;
  club: { name: string };
  sources: SiteSource[];
  competitions: Competition[];
  mirrors: MirroredCompetition[];
  teams: Team[];
  matches: Match[];
}
