import type { BehaviourSummary, StudentEntry } from './student-analysis';

export type Recipient = 'counsellor' | 'principal' | 'both';
export type Purpose = 'support' | 'info' | 'meeting';

export const RECIPIENTS: Array<{ id: Recipient; label: string }> = [
  { id: 'counsellor', label: 'Rehber Öğretmen (Student counsellor)' },
  { id: 'principal', label: 'Okul Müdürü (Principal)' },
  { id: 'both', label: 'Her ikisi (Both)' },
];
export const PURPOSES: Array<{ id: Purpose; label: string }> = [
  { id: 'support', label: 'Rehberlik desteği talebi (Request for support)' },
  { id: 'info', label: 'Bilgilendirme (Information)' },
  { id: 'meeting', label: 'Görüşme talebi (Request for a meeting)' },
];

const TR_CRITERIA: Record<string, string> = {
  homework_complete: 'ödev tamamlama',
  class_participation: 'derse katılım',
  speaking_effort: 'konuşma çabası',
  project_complete: 'proje tamamlama',
  class_readiness: 'derse hazırlık',
  speaking_day_rules: 'konuşma günü kurallarına uyma',
};
const TR_BY_LABEL: Record<string, string> = {
  'Homework completed': TR_CRITERIA.homework_complete,
  'Class participation': TR_CRITERIA.class_participation,
  'Effort in speaking': TR_CRITERIA.speaking_effort,
  'Project completed': TR_CRITERIA.project_complete,
  'Classwise readiness': TR_CRITERIA.class_readiness,
  'Followed speaking-day rules': TR_CRITERIA.speaking_day_rules,
};

const trDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
const upper = (s: string) => s.toLocaleUpperCase('tr-TR');
const list = (items: string[]) => items.map((s) => TR_BY_LABEL[s] ?? s.toLocaleLowerCase('tr-TR')).join(', ');

export type PetitionInput = {
  recipient: Recipient;
  purpose: Purpose;
  school: string;
  teacher: string;
  date: string; // YYYY-MM-DD
  studentName: string;
  classroom: string;
  summary: BehaviourSummary | null;
  entries: StudentEntry[];
};

/** Builds a formal Turkish dilekçe (petition letter) from a student's analysis. The teacher can edit the text afterwards. */
export function buildPetition(p: PetitionInput): string {
  const school = p.school.trim() ? upper(p.school.trim()) : '……………………………';
  const name = p.studentName.trim();
  const klass = p.classroom.trim();

  const to = p.recipient === 'principal'
    ? [`${school} MÜDÜRLÜĞÜNE`]
    : p.recipient === 'counsellor'
      ? [`${school} REHBERLİK SERVİSİNE`, '(Rehber Öğretmen)']
      : [`${school} MÜDÜRLÜĞÜNE`, 've REHBERLİK SERVİSİNE'];

  const subject = p.purpose === 'support' ? `${name} adlı öğrencinin rehberlik desteği talebi hakkında.`
    : p.purpose === 'info' ? `${name} adlı öğrencinin durumu hakkında bilgilendirme.`
      : `${name} adlı öğrenci ile ilgili görüşme talebi.`;

  const request = p.purpose === 'support'
    ? (p.recipient === 'principal'
      ? 'gerekli önlemlerin alınmasını ve öğrencinin rehberlik servisine yönlendirilmesini'
      : 'öğrencinin değerlendirilmesini ve gerekli rehberlik desteğinin sağlanmasını')
    : p.purpose === 'info'
      ? 'durumun bilgilerinize sunulmasını'
      : 'ilgili taraflarla bir görüşme yapılmasını';

  const lines: string[] = ['T.C.', ...to, '', `Tarih: ${trDate(p.date)}`, '', `Konu: ${subject}`, ''];
  lines.push(`Okulunuz${klass ? ` ${klass} sınıfı` : ''} öğrencisi ${name} ile ilgili aşağıda sunduğum gözlemler doğrultusunda ${request} saygılarımla arz ederim.`, '');

  const take = (area: 'academic' | 'behaviour') => p.entries.filter((e) => e.area === area).slice(0, 5);
  const academic = take('academic'), behaviour = take('behaviour');
  const block = (title: string, items: StudentEntry[]) => {
    if (!items.length) return;
    lines.push(`${title}:`);
    for (const e of items) lines.push(`• (${trDate(e.entry_date)}) ${e.body.trim().replace(/\s*\n+\s*/g, ' ')}`);
    lines.push('');
  };
  block('Akademik gözlemlerim', academic);
  block('Davranışsal gözlemlerim', behaviour);

  const s = p.summary;
  if (s && s.days > 0 && s.overall !== null) {
    let line = `Günlük hedef çizelgesi (son 90 gün, ${s.days} günlük kayıt): öğrenci günlük hedeflerin %${s.overall}’ini karşılamıştır.`;
    if (s.trend === 'up') line += ' Son iki haftada olumlu yönde bir gelişme görülmektedir.';
    else if (s.trend === 'down') line += ' Son iki haftada gerileme görülmektedir.';
    else if (s.trend === 'steady') line += ' Son iki haftada durum genel olarak sabittir.';
    lines.push(line);
    if (s.strengths.length) lines.push(`Güçlü olduğu alanlar: ${list(s.strengths)}.`);
    if (s.needsAttention.length) lines.push(`Desteğe ihtiyaç duyduğu alanlar: ${list(s.needsAttention)}.`);
    lines.push('');
  }

  lines.push('Gereğini bilgilerinize arz ederim.', '', 'Saygılarımla,', '', p.teacher.trim() || '…………………………', 'Öğretmen');
  return lines.join('\n');
}
