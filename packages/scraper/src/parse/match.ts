import { load } from 'cheerio';
import type { SetScore } from '../model';
import { clean, parseDateTime } from './common';

export interface MatchDetail {
  home: string | null;
  away: string | null;
  sets: SetScore[];
  startsAt: string | null;
  venue: string | null;
  referees: string[];
  durationMinutes: number | null;
  homeJersey: string | null;
  number: number | null;
}

/** Čita stranicu pojedine utakmice (dvorana, vrijeme početka, suci, trajanje). */
export function parseMatchPage(html: string): MatchDetail {
  const $ = load(html);
  const title = $('.ispisNaslov').first();
  const names = title
    .find('span.linkUNaslovu')
    .map((_, s) => clean($(s).text()))
    .get();

  const fields = new Map<string, string>();
  $('.ispisTekst').each((_, td) => {
    // Jedna ćelija može sadržavati više redaka razdvojenih s <br/>, npr. setove.
    for (const piece of ($(td).html() ?? '').split(/<br\s*\/?>/iu)) {
      const text = clean(load(`<div>${piece}</div>`)('div').text());
      const m = text.match(/^([^:]+):\s*(.*)$/u);
      if (!m) continue;
      const label = clean(m[1]);
      if (label && !fields.has(label)) fields.set(label, clean(m[2]));
    }
  });
  const get = (label: string): string | null => fields.get(label) || null;

  const sets: SetScore[] = [];
  for (let i = 1; i <= 5; i++) {
    const m = get(`${i}. set`)?.match(/(\d+)\s*:\s*(\d+)/u);
    if (m) sets.push({ home: Number(m[1]), away: Number(m[2]) });
  }

  const duration = get('Ukupno trajanje utakmice')?.match(/(\d+)/u);
  const number = get('Broj utakmice')?.match(/(\d+)/u);

  return {
    home: names[0] ?? null,
    away: names[1] ?? null,
    sets,
    startsAt: parseDateTime(get('Vrijeme početka') ?? ''),
    venue: get('Dvorana'),
    referees: [get('1. sudac'), get('2. sudac / zapisničar')].filter((r): r is string => !!r),
    durationMinutes: duration ? Number(duration[1]) : null,
    homeJersey: get('Boja dresova domaćina'),
    number: number ? Number(number[1]) : null,
  };
}
