export const CRITERIA = [
  { key: 'homework_complete', label: 'Homework completed' },
  { key: 'class_participation', label: 'Class participation' },
  { key: 'speaking_effort', label: 'Effort in speaking' },
  { key: 'project_complete', label: 'Project completed' },
  { key: 'class_readiness', label: 'Classwise readiness' },
  { key: 'speaking_day_rules', label: 'Followed speaking-day rules' },
] as const;
export type CriterionKey = (typeof CRITERIA)[number]['key'];

export type DayRecord = { date: string; criteria: Record<CriterionKey, boolean> };
export type BehaviourSummary = {
  days: number;
  overall: number | null; // 0–100
  trend: 'up' | 'down' | 'steady' | null; // last 14 days against the 14 before
  perCriterion: Array<{ key: CriterionKey; label: string; percent: number }>;
  strengths: string[];
  needsAttention: string[];
};
export type StudentEntry = { id: string; area: 'academic' | 'behaviour'; body: string; entry_date: string; source: 'typed' | 'photo' };

const percent = (records: DayRecord[], keys: readonly CriterionKey[]) => {
  const total = records.length * keys.length;
  if (!total) return null;
  return Math.round((records.reduce((n, r) => n + keys.filter((k) => r.criteria[k]).length, 0) / total) * 100);
};

/** Summarise the daily checklist records (any order) into overall score, trend, strengths and gaps. */
export function summariseBehaviour(records: DayRecord[], today: string): BehaviourSummary {
  const all = CRITERIA.map((c) => c.key);
  const perCriterion = CRITERIA.map((c) => ({ key: c.key, label: c.label, percent: percent(records, [c.key]) ?? 0 }));
  const day = (iso: string, back: number) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d - back)); return t.toISOString().slice(0, 10); };
  const recent = records.filter((r) => r.date > day(today, 14));
  const before = records.filter((r) => r.date <= day(today, 14) && r.date > day(today, 28));
  const a = percent(recent, all), b = percent(before, all);
  const trend = a === null || b === null ? null : a - b >= 8 ? 'up' : b - a >= 8 ? 'down' : 'steady';
  return {
    days: records.length,
    overall: percent(records, all),
    trend,
    perCriterion,
    strengths: records.length ? perCriterion.filter((c) => c.percent >= 80).map((c) => c.label) : [],
    needsAttention: records.length ? perCriterion.filter((c) => c.percent < 50).map((c) => c.label) : [],
  };
}
