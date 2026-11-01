import type { SiteId } from './model';

export interface SiteConfig {
  id: SiteId;
  name: string;
  baseUrl: string;
}

export const SITES: SiteConfig[] = [
  { id: 'osvz', name: 'Odbojkaški savez Varaždinske županije', baseUrl: 'https://osvz.hr' },
  { id: 'osmz', name: 'Odbojkaški savez Međimurske županije', baseUrl: 'https://www.osmz.hr' },
];

export const CLUB = {
  name: 'OK Štrigova',
  /** "OK Štrigova", "OK Štrigova 2", "OK Štrigova 3" … */
  teamPattern: /^OK Štrigova(?: \d+)?$/iu,
};

export function isClubTeam(name: string): boolean {
  return CLUB.teamPattern.test(name.trim());
}

export const USER_AGENT = 'ok-strigova-scraper/0.1 (+https://github.com/nrisek/ok-strigova)';
export const REQUEST_DELAY_MS = 800;

export function competitionUrl(baseUrl: string, sourceId: number): string {
  return `${baseUrl}/index.php?rubrika=utakmica&natjecanje=${sourceId}`;
}
export function teamUrl(baseUrl: string, sourceId: number): string {
  return `${baseUrl}/index.php?rubrika=ekipa&obrazac=1&id=${sourceId}`;
}
export function matchUrl(baseUrl: string, sourceId: number): string {
  return `${baseUrl}/index.php?rubrika=utakmica&obrazac=1&id=${sourceId}`;
}
