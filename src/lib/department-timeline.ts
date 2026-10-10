export type Activity = { id: string; activity_date: string; title: string; source: 'typed' | 'photo' };
export type ParsedActivity = { date: string; title: string };

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, ocak: 1, february: 2, feb: 2, subat: 2, march: 3, mar: 3, mart: 3, april: 4, apr: 4, nisan: 4, may: 5, mayis: 5,
  june: 6, jun: 6, haziran: 6, july: 7, jul: 7, temmuz: 7, august: 8, aug: 8, agustos: 8, september: 9, sep: 9, sept: 9, eylul: 9,
  october: 10, oct: 10, ekim: 10, november: 11, nov: 11, kasim: 11, december: 12, dec: 12, aralik: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const fold = (s: string) => s.replace(/İ/g, 'i').toLowerCase().replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
const p2 = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${p2(m)}-${p2(d)}`;
const valid = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };

/** When a date has no year, use this year unless that is more than ~6 months in the past, then next year. */
function withYear(m: number, d: number, today: string): string | null {
  const y = Number(today.slice(0, 4));
  const limit = new Date(today + 'T00:00:00Z').getTime() - 180 * 86400000;
  for (const year of [y, y + 1]) if (valid(year, m, d) && new Date(iso(year, m, d) + 'T00:00:00Z').getTime() >= limit) return iso(year, m, d);
  return null;
}
const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/** Find one date in a line. Returns the ISO date and the line with the date text removed. */
export function extractDate(line: string, today: string): { date: string; rest: string } | null {
  let text = fold(line).replace(/(\d{1,2})\s*[-–]\s*\d{1,2}(\s+(?:[a-z]+))/g, '$1$2'); // "12-14 ekim" -> "12 ekim"
  const tries: Array<[RegExp, (m: RegExpMatchArray) => string | null]> = [
    [/(\d{4})-(\d{1,2})-(\d{1,2})/, (m) => (valid(+m[1], +m[2], +m[3]) ? iso(+m[1], +m[2], +m[3]) : null)],
    [/(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/, (m) => { const y = fullYear(m[3]); return valid(y, +m[2], +m[1]) ? iso(y, +m[2], +m[1]) : null; }],
    [new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})\\b\\.?(?:\\s+(\\d{4}))?`), (m) => (m[3] ? (valid(+m[3], MONTHS[m[2]], +m[1]) ? iso(+m[3], MONTHS[m[2]], +m[1]) : null) : withYear(MONTHS[m[2]], +m[1], today))],
    [new RegExp(`\\b(${MONTH_RE})\\b\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`), (m) => (m[3] ? (valid(+m[3], MONTHS[m[1]], +m[2]) ? iso(+m[3], MONTHS[m[1]], +m[2]) : null) : withYear(MONTHS[m[1]], +m[2], today))],
    [/(?<![\d./])(\d{1,2})[./](\d{1,2})(?![\d./])/, (m) => withYear(+m[2], +m[1], today)],
  ];
  for (const [re, toDate] of tries) {
    const m = text.match(re);
    if (!m) continue;
    const date = toDate(m);
    if (date) return { date, rest: text.slice(0, m.index!) + ' ' + text.slice(m.index! + m[0].length) };
  }
  return null;
}

const clean = (s: string) => s.replace(/^[\s\-–—:;,.|•*·>)]+|[\s\-–—:;,.|•*·(]+$/g, '').replace(/\s{2,}/g, ' ').trim();

/**
 * Turn text read from a picture into dated activities. The original casing is kept for titles:
 * `fold` keeps the same length, so positions found in the folded text line up with the original.
 */
export function parseActivities(text: string, today: string): ParsedActivity[] {
  const out: ParsedActivity[] = [];
  let pendingDate: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/(\d{1,2})\s*[-–]\s*\d{1,2}(\s+\p{L}+)/gu, '$1$2'); // "12-14 Kasım" -> "12 Kasım"
    if (!line) continue;
    const found = extractDate(line, today);
    if (found) {
      // Recover the title from the original line by removing the same date text.
      const original = removeDateText(line, found.rest);
      const title = clean(original);
      if (title) { out.push({ date: found.date, title }); pendingDate = null; } else pendingDate = found.date;
    } else if (pendingDate) {
      out.push({ date: pendingDate, title: clean(line) }); pendingDate = null;
    } else if (out.length && clean(line).length > 2) {
      out[out.length - 1].title += ' — ' + clean(line); // wrapped line of the previous activity
    }
  }
  return out.filter((a) => a.title.length > 0);
}

/** `foldedRest` is the folded line without the date. Re-apply that removal to the original casing (folding keeps every character's position). */
function removeDateText(original: string, foldedRest: string): string {
  const folded = fold(original);
  const start = commonPrefix(folded, foldedRest);
  const removed = folded.length - (foldedRest.length - 1); // -1 for the space inserted at the join
  return original.slice(0, start) + ' ' + original.slice(start + removed);
}
function commonPrefix(a: string, b: string) { let i = 0; while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++; return i; }

export const daysUntil = (date: string, today: string) => Math.round((new Date(date + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000);

/** Activities from today onwards, soonest first. */
export const upcoming = (list: Activity[], today: string) => list.filter((a) => a.activity_date >= today).sort((a, b) => a.activity_date.localeCompare(b.activity_date));
