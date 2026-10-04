import 'server-only';
import { sqlClient } from '@/lib/db';

const avatars: Record<string, string> = {
  fox:'🦊',bear:'🐻',panda:'🐼',lion:'🦁',frog:'🐸',tiger:'🐯',koala:'🐨',unicorn:'🦄',penguin:'🐧',octopus:'🐙',dolphin:'🐬',whale:'🐳',turtle:'🐢',butterfly:'🦋',bee:'🐝',ladybug:'🐞',parrot:'🦜',flamingo:'🦩',peacock:'🦚',rabbit:'🐰',cat:'🐱',dog:'🐶',hamster:'🐹',monkey:'🐵',elephant:'🐘',giraffe:'🦒',zebra:'🦓',crocodile:'🐊',dinosaur:'🦖',dragon:'🐲',owl:'🦉',chick:'🐥',hedgehog:'🦔',raccoon:'🦝',squirrel:'🐿️',otter:'🦦',seal:'🦭',sloth:'🦥',llama:'🦙',deer:'🦌',horse:'🐴',mouse:'🐭',wolf:'🐺',bird:'🐦',shell:'🐚',star:'⭐',rainbow:'🌈',rocket:'🚀',heart:'💖',sun:'☀️',flower:'🌸',cherry:'🍒',cupcake:'🧁',icecream:'🍦',robot:'🤖',alien:'👽',
};

function publicName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length < 2 ? parts[0] || '' : `${parts[0]} ${parts.slice(1).map(part => `${Array.from(part)[0]?.toLocaleUpperCase() || ''}.`).join(' ')}`;
}

export async function getPublicStudentBubbles() {
  try {
    const rows = await sqlClient()`
      SELECT s.id, s.display_name, s.avatar_key,
        COALESCE(SUM(
          COALESCE((br.criteria->>'homework_complete')::boolean, FALSE)::int +
          COALESCE((br.criteria->>'class_participation')::boolean, FALSE)::int +
          COALESCE((br.criteria->>'speaking_effort')::boolean, FALSE)::int +
          COALESCE((br.criteria->>'project_complete')::boolean, FALSE)::int +
          COALESCE((br.criteria->>'class_readiness')::boolean, FALSE)::int +
          COALESCE((br.criteria->>'speaking_day_rules')::boolean, FALSE)::int
        ), 0)::int AS points
      FROM students s
      JOIN groups g ON g.id = s.group_id
      JOIN classrooms c ON c.id = g.classroom_id
      LEFT JOIN behavior_records br ON br.student_id = s.id
      WHERE s.archived_at IS NULL AND g.archived_at IS NULL AND c.archived_at IS NULL
      GROUP BY s.id, c.name
      ORDER BY points DESC, c.name, s.display_name
    `;
    return rows.flatMap(row => {
      const name = publicName(String(row.display_name || ''));
      if (!name) return [];
      return [{ id: String(row.id), name, avatar: avatars[String(row.avatar_key)] || '🌟', points: Number(row.points) || 0 }];
    });
  } catch {
    // Keep the public welcome and sign-in pages available when the roster is temporarily unavailable.
    return [];
  }
}
