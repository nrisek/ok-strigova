import { load } from 'cheerio';
import { clean } from './common';

export interface TeamInfo {
  name: string;
  club: string | null;
  hall: string | null;
  category: string | null;
  gender: string | null;
  contact: string | null;
}

/** Čita zaglavlje stranice ekipe (klub, dvorana, kategorija, spol, kontakt). */
export function parseTeamPage(html: string): TeamInfo {
  const $ = load(html);
  const fields = new Map<string, string>();
  $('.ispisTekst').each((_, td) => {
    const label = clean($(td).find('b').first().text()).replace(/:$/u, '');
    if (!label) return;
    const value = clean($(td).text()).replace(new RegExp(`^${escapeRegExp(label)}:?\\s*`, 'u'), '');
    if (!fields.has(label)) fields.set(label, value);
  });
  const get = (label: string): string | null => fields.get(label) || null;
  return {
    name: clean($('.ispisNaslov').first().text()),
    club: get('Klub'),
    hall: get('Dvorana'),
    category: get('Kategorija'),
    gender: get('Spol'),
    contact: get('Osoba za kontakt'),
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
