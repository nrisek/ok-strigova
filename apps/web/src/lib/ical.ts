import type { Match } from '@ok-strigova/scraper/model';

const TIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Zagreb',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

const escapeText = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** RFC 5545: redci do 75 okteta, nastavak počinje razmakom. */
function fold(line: string): string {
  const out: string[] = [];
  let current = '';
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, 'utf8') > 73) {
      out.push(current);
      current = ` ${ch}`;
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.join('\r\n');
}

const compact = (iso: string): string => iso.replace(/[-:]/g, '');

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMinutes(iso: string, minutes: number): string {
  const d = new Date(`${iso}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

export interface CalendarOptions {
  name: string;
  matches: Match[];
  /** ISO trenutak generiranja podataka. */
  stamp: string;
  competitionName: (competitionId: string) => string;
}

/** Gradi iCalendar feed: utakmice s terminom kao događaji od 2 sata, ostale kao cjelodnevni u danima kola. */
export function buildCalendar({ name, matches, stamp, competitionName }: CalendarOptions): string {
  const dtstamp = compact(stamp.replace(/\.\d+Z$/u, 'Z'));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OK Štrigova//Raspored utakmica//HR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    'X-WR-TIMEZONE:Europe/Zagreb',
    ...TIMEZONE,
  ];

  for (const m of matches) {
    if (m.status === 'bye') continue;
    const start = m.scheduledAt ?? m.roundDates[0];
    if (!start) continue;

    const result = m.result ? ` ${m.result.home}:${m.result.away}` : '';
    let summary = `${m.home} – ${m.away}${result}`;
    if (m.status === 'postponed') summary += ' (odgođeno)';
    if (m.status === 'tbd') summary += ' (termin nije određen)';

    const description = [
      competitionName(m.competitionId) + (m.round ? `, ${m.round}. kolo` : ''),
      m.sets.length ? `Setovi: ${m.sets.map((s) => `${s.home}:${s.away}`).join(', ')}` : '',
      m.url,
    ]
      .filter(Boolean)
      .join('\n');

    lines.push('BEGIN:VEVENT', `UID:${m.id}@ok-strigova`, `DTSTAMP:${dtstamp}`);
    if (start.length > 10) {
      lines.push(`DTSTART;TZID=Europe/Zagreb:${compact(start)}00`, `DTEND;TZID=Europe/Zagreb:${compact(addMinutes(start, 120))}00`);
    } else {
      const lastDay = m.scheduledAt ? start : (m.roundDates[m.roundDates.length - 1] ?? start);
      lines.push(`DTSTART;VALUE=DATE:${compact(start)}`, `DTEND;VALUE=DATE:${compact(addDays(lastDay, 1))}`);
    }
    lines.push(`SUMMARY:${escapeText(summary)}`);
    if (m.venue) lines.push(`LOCATION:${escapeText(m.venue)}`);
    lines.push(`DESCRIPTION:${escapeText(description)}`, `URL:${m.url}`, 'END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
