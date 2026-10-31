import type { Match, SetScore } from '@ok-strigova/scraper/model';

// Vremena su zapisana kao lokalno vrijeme bez zone ("2026-10-04T17:00"), pa ih čitamo kao UTC
// i formatiramo u UTC-u da se ne pomaknu ovisno o poslužitelju na kojem se gradi stranica.
const TZ = 'UTC';
const fmt = (opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('hr-HR', { timeZone: TZ, ...opts });

const dayFmt = fmt({ weekday: 'short', day: 'numeric', month: 'long' });
const dayFullFmt = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dayMonthFmt = fmt({ day: 'numeric', month: 'long' });
const monthFmt = fmt({ month: 'long', year: 'numeric' });
const timeFmt = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function asDate(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : `${iso}:00Z`);
}

export function hasTime(iso: string): boolean {
  return iso.length > 10;
}

/** "ned, 4. listopada" */
export function formatDay(iso: string): string {
  return dayFmt.format(asDate(iso));
}

/** "nedjelja, 4. listopada 2026." */
export function formatDayFull(iso: string): string {
  return dayFullFmt.format(asDate(iso));
}

/** "17:00" ili null kad je poznat samo datum. */
export function formatTime(iso: string): string | null {
  return hasTime(iso) ? timeFmt.format(asDate(iso)) : null;
}

/** "ned, 4. listopada u 17:00" */
export function formatWhen(iso: string): string {
  const time = formatTime(iso);
  return time ? `${formatDay(iso)} u ${time}` : formatDay(iso);
}

/** "listopad 2026" */
export function formatMonth(iso: string): string {
  return monthFmt.format(asDate(iso.slice(0, 10))).replace(/\.$/u, '');
}

/** ["2026-10-03","2026-10-04"] → "3. – 4. listopada" */
export function formatRange(dates: string[]): string {
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return '';
  if (first === last) return dayMonthFmt.format(asDate(first));
  if (first.slice(0, 7) === last.slice(0, 7)) return `${Number(first.slice(8, 10))}. – ${dayMonthFmt.format(asDate(last))}`;
  return `${dayMonthFmt.format(asDate(first))} – ${dayMonthFmt.format(asDate(last))}`;
}

/** Stvarni trenutak (UTC ISO) prikazan u zagrebačkom vremenu, npr. "31. lis 2026. 08:05". */
export function formatStamp(isoUtc: string): string {
  return new Intl.DateTimeFormat('hr-HR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Zagreb' }).format(
    new Date(isoUtc),
  );
}

export function formatSets(sets: SetScore[]): string {
  return sets.map((s) => `${s.home}:${s.away}`).join(', ');
}

export function formatResult(m: Match): string | null {
  return m.result ? `${m.result.home}:${m.result.away}` : null;
}
