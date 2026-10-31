const MONTHS: Record<string, number> = {
  siječnja: 1,
  veljače: 2,
  ožujka: 3,
  travnja: 4,
  svibnja: 5,
  lipnja: 6,
  srpnja: 7,
  kolovoza: 8,
  rujna: 9,
  listopada: 10,
  studenog: 11,
  studenoga: 11,
  prosinca: 12,
};

const pad = (n: number): string => String(n).padStart(2, '0');

/** Sažima razmake i uklanja nbsp. */
export function clean(s: string | undefined | null): string {
  return (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/** Pronalazi sve hrvatske datume oblika "3. listopada 2026." i vraća ih kao ISO datume. */
export function findDates(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(\d{1,2})\.\s*([a-zčćžšđ]+)\s+(\d{4})\./giu)) {
    const month = MONTHS[(m[2] ?? '').toLowerCase()];
    if (!month) continue;
    out.push(`${m[3]}-${pad(month)}-${pad(Number(m[1]))}`);
  }
  return out;
}

/** "nedjelja, 4. listopada 2026. u 17,00" → "2026-10-04T17:00"; bez vremena → "2026-10-04". */
export function parseDateTime(text: string): string | null {
  const [date] = findDates(text);
  if (!date) return null;
  const t = text.match(/\bu\s+(\d{1,2})[,.:](\d{2})\b/u);
  return t ? `${date}T${pad(Number(t[1]))}:${t[2]}` : date;
}

export function idFromHref(href: string | undefined, param = 'id'): number | null {
  if (!href) return null;
  const m = href.match(new RegExp(`[?&]${param}=(\\d+)`));
  return m ? Number(m[1]) : null;
}

/** "3. HOL … – seniorke" → { name, category }. Razdjelnik je crtica (en dash). */
export function splitTitle(text: string): { name: string; category: string | null } {
  const t = clean(text);
  const i = t.lastIndexOf(' – ');
  if (i < 0) return { name: t, category: null };
  return { name: clean(t.slice(0, i)), category: clean(t.slice(i + 3)) || null };
}

export function parseNumber(text: string): number {
  const n = Number(clean(text).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** "3.6667" → 3.6667; "∞" ili prazno → null. */
export function parseRatio(text: string): number | null {
  const t = clean(text);
  if (!t || t === '∞') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function slugify(s: string): string {
  return clean(s)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
