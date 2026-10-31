import { load } from 'cheerio';
import { clean, idFromHref } from './common';

export interface NavCompetition {
  sourceId: number;
  title: string;
  section: string;
}

export interface NavInfo {
  competitions: NavCompetition[];
  lastChange: string | null;
  siteTitle: string | null;
}

/** Čita izbornik natjecanja (lijevi stupac) s bilo koje stranice saveza. */
export function parseNav(html: string): NavInfo {
  const $ = load(html);
  const competitions: NavCompetition[] = [];
  const seen = new Set<number>();

  $('h4').each((_, h4) => {
    const section = clean($(h4).text());
    $(h4)
      .next('ul')
      .find('a[href*="natjecanje="]')
      .each((_, a) => {
        const sourceId = idFromHref($(a).attr('href'), 'natjecanje');
        if (!sourceId || seen.has(sourceId)) return;
        seen.add(sourceId);
        competitions.push({ sourceId, title: clean($(a).text()), section });
      });
  });

  return {
    competitions,
    lastChange: parseLastChange($.text()),
    siteTitle: clean($('meta[property="og:site_name"]').attr('content') ?? $('h1').first().text()) || null,
  };
}

export function parseLastChange(text: string): string | null {
  const m = text.match(/zadnja promjena:\s*([^\n]+)/iu);
  return m ? clean(m[1]) : null;
}
