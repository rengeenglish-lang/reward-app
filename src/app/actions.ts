'use server';

import { redirect } from 'next/navigation';
import argon2 from 'argon2';
import { z } from 'zod';
import { sqlClient } from '@/lib/db';
import { createSession, requireTutor, revokeSession } from '@/lib/session';

const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(100);
const avatarKeys = ['fox','bear','panda','lion','frog','tiger','koala','unicorn','penguin','octopus','dolphin','whale','turtle','butterfly','bee','ladybug','parrot','flamingo','peacock','rabbit','cat','dog','hamster','monkey','elephant','giraffe','zebra','crocodile','dinosaur','dragon','owl','chick','hedgehog','raccoon','squirrel','otter','seal','sloth','llama','deer','horse','mouse','wolf','bird','shell','star','rainbow','rocket','heart','sun','flower','cherry','cupcake','icecream','robot','alien'] as const;
const criteriaKeys = ['homework_complete','class_participation','speaking_effort','project_complete','class_readiness','speaking_day_rules'] as const;
const criteriaShape = Object.fromEntries(criteriaKeys.map(k => [k,z.boolean()]));
const criteriaSchema = z.object(criteriaShape).strict();

export async function signIn(formData: FormData) {
  const email = z.string().email().safeParse(formData.get('email'));
  const password = z.string().min(1).safeParse(formData.get('password'));
  if (!email.success || !password.success) redirect('/login?error=1');
  const address=email.data.toLowerCase(),sql=sqlClient();
  const attempts=await sql`SELECT locked_until > now() AS locked FROM tutor_login_attempts WHERE email=${address}`;
  const rows = attempts[0]?.locked ? [] : await sql`SELECT id,password_hash FROM tutor WHERE email=${address} LIMIT 1`;
  if (!rows.length || !(await argon2.verify(String(rows[0].password_hash), password.data))) {
    await sql`INSERT INTO tutor_login_attempts(email,attempts,window_started_at) VALUES(${address},1,now())
      ON CONFLICT(email) DO UPDATE SET
      attempts=CASE WHEN tutor_login_attempts.window_started_at < now()-interval '15 minutes' THEN 1 ELSE tutor_login_attempts.attempts+1 END,
      window_started_at=CASE WHEN tutor_login_attempts.window_started_at < now()-interval '15 minutes' THEN now() ELSE tutor_login_attempts.window_started_at END,
      locked_until=CASE WHEN tutor_login_attempts.window_started_at < now()-interval '15 minutes' THEN NULL WHEN tutor_login_attempts.attempts >= 4 THEN now()+interval '15 minutes' ELSE tutor_login_attempts.locked_until END`;
    redirect('/login?error=1');
  }
  await sql`DELETE FROM tutor_login_attempts WHERE email=${address}`;
  await createSession(String(rows[0].id)); redirect('/classroom');
}
export async function signOut() { await revokeSession(); redirect('/login'); }

export async function updateTutorSettings(input:{displayName:string;timezone:string}) {
  const tutor=await requireTutor(),displayName=name.parse(input.displayName),timezone=z.string().min(1).max(100).parse(input.timezone);
  try { new Intl.DateTimeFormat('en-US',{timeZone:timezone}); } catch { throw new Error('Choose a valid timezone'); }
  await sqlClient()`UPDATE tutor SET display_name=${displayName},timezone=${timezone},updated_at=now() WHERE id=${tutor.id}`;
  return {displayName,timezone};
}

export async function changeTutorPassword(input:{currentPassword:string;newPassword:string;confirmation:string}) {
  const tutor=await requireTutor(),currentPassword=z.string().min(1).max(200).parse(input.currentPassword),newPassword=z.string().min(8).max(200).parse(input.newPassword),confirmation=z.string().max(200).parse(input.confirmation);
  if(newPassword!==confirmation) throw new Error('The new passwords do not match');
  const sql=sqlClient(),rows=await sql`SELECT password_hash FROM tutor WHERE id=${tutor.id}`;
  if(!rows.length||!(await argon2.verify(String(rows[0].password_hash),currentPassword))) throw new Error('Current password is incorrect');
  await sql`UPDATE tutor SET password_hash=${await argon2.hash(newPassword,{type:argon2.argon2id})},updated_at=now() WHERE id=${tutor.id}`;
  await sql`DELETE FROM tutor_sessions WHERE tutor_id=${tutor.id}`;
  await createSession(tutor.id);
  return true;
}

export async function getInitialData() {
  const tutor = await requireTutor(), sql = sqlClient();
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:tutor.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const [classrooms,groups,students,prizes,recentDraws] = await Promise.all([
    sql`SELECT id,name FROM classrooms WHERE archived_at IS NULL ORDER BY name`,
    sql`SELECT g.id,g.name,g.grade_label,g.classroom_id,c.name AS classroom_name FROM groups g JOIN classrooms c ON c.id=g.classroom_id WHERE g.archived_at IS NULL AND c.archived_at IS NULL ORDER BY c.name,g.name`,
    sql`SELECT s.id,s.display_name,s.avatar_key,s.group_id,g.classroom_id,c.name AS classroom_name,br.criteria FROM students s JOIN groups g ON g.id=s.group_id JOIN classrooms c ON c.id=g.classroom_id LEFT JOIN behavior_records br ON br.student_id=s.id AND br.record_date=${today} WHERE s.archived_at IS NULL AND g.archived_at IS NULL AND c.archived_at IS NULL ORDER BY s.display_name`,
    sql`SELECT id,name,description,active FROM prizes ORDER BY active DESC,name`,
    sql`SELECT d.id,d.drawn_at,d.prize_name_snapshot AS prize,s.display_name AS student,s.avatar_key FROM reward_draws d JOIN students s ON s.id=d.student_id ORDER BY d.drawn_at DESC LIMIT 8`
  ]);
  // "Book returned" lives in a column added by migration 0006. Read it separately so the page still loads before that migration is applied.
  const returned = new Map<string, boolean>();
  try {
    if (recentDraws.length) {
      const flags = await sql`SELECT id,book_returned FROM reward_draws WHERE id = ANY(string_to_array(${recentDraws.map(d=>String(d.id)).join(',')},',')::uuid[])`;
      for (const f of flags) returned.set(String(f.id), Boolean(f.book_returned));
    }
  } catch { /* column not there yet */ }
  return {tutor,today,classrooms,groups,students,prizes,recentDraws:recentDraws.map(d=>({...d,book_returned:returned.get(String(d.id))??false}))};
}

export async function setBookReturned(drawId: string, returned: boolean) {
  await requireTutor(); const id=uuid.parse(drawId),flag=z.boolean().parse(returned);
  const rows=await sqlClient()`UPDATE reward_draws SET book_returned=${flag} WHERE id=${id} RETURNING id,book_returned`;
  if(!rows.length) throw new Error('Reward not found'); return rows[0];
}

export async function getBooks() {
  await requireTutor();
  return sqlClient()`SELECT id,title,series,level,cover_path,aspect::float AS aspect,position FROM books WHERE active ORDER BY position`;
}

const readerField = z.enum(['returned', 'project_done']);

/** Everything the "Our Readers" list needs for one class: each student's books, plus students who have none yet. */
export async function getReaders(classroomId: string) {
  await requireTutor(); const classroom=uuid.parse(classroomId),sql=sqlClient();
  const rows=await sql`SELECT sb.id,s.id AS student_id,s.display_name AS student,s.avatar_key,b.id AS book_id,b.title,sb.returned,sb.project_done
    FROM student_books sb JOIN students s ON s.id=sb.student_id JOIN groups g ON g.id=s.group_id JOIN books b ON b.id=sb.book_id
    WHERE g.classroom_id=${classroom}::uuid AND s.archived_at IS NULL AND g.archived_at IS NULL
    ORDER BY sb.returned ASC,s.display_name,sb.assigned_at DESC`;
  const without=await sql`SELECT s.id AS student_id,s.display_name AS student,s.avatar_key FROM students s JOIN groups g ON g.id=s.group_id
    WHERE g.classroom_id=${classroom}::uuid AND s.archived_at IS NULL AND g.archived_at IS NULL AND NOT EXISTS (SELECT 1 FROM student_books x WHERE x.student_id=s.id)
    ORDER BY s.display_name`;
  return {rows,without};
}

/** Gives one book to every active student in the class. Students who already have it are skipped. Returns how many got it. */
export async function assignBookToClass(classroomId: string, bookId: string, studentIds?: string[]) {
  await requireTutor(); const classroom=uuid.parse(classroomId),book=uuid.parse(bookId);
  // Roll call: when the tutor sends the ids of students who are here, only they get the book.
  const here=studentIds?z.array(uuid).max(500).parse(studentIds):null; if(here&&!here.length) return 0; const hereCsv=here?here.join(','):null;
  const rows=await sqlClient()`INSERT INTO student_books(student_id,book_id)
    SELECT s.id,${book}::uuid FROM students s JOIN groups g ON g.id=s.group_id
    WHERE g.classroom_id=${classroom}::uuid AND s.archived_at IS NULL AND g.archived_at IS NULL
    AND (${hereCsv}::text IS NULL OR s.id = ANY(string_to_array(${hereCsv},',')::uuid[]))
    ON CONFLICT (student_id,book_id) DO NOTHING RETURNING id`;
  return rows.length;
}

export async function assignBook(studentId: string, bookId: string) {
  await requireTutor(); const student=uuid.parse(studentId),book=uuid.parse(bookId);
  await sqlClient()`INSERT INTO student_books(student_id,book_id) VALUES(${student}::uuid,${book}::uuid) ON CONFLICT (student_id,book_id) DO NOTHING`;
  return true;
}

export async function setReaderFlag(id: string, field: 'returned' | 'project_done', value: boolean) {
  await requireTutor(); const key=uuid.parse(id),which=readerField.parse(field),flag=z.boolean().parse(value),sql=sqlClient();
  const rows=which==='returned'
    ? await sql`UPDATE student_books SET returned=${flag},returned_at=CASE WHEN ${flag}::boolean THEN now() ELSE NULL END WHERE id=${key}::uuid RETURNING id`
    : await sql`UPDATE student_books SET project_done=${flag},project_done_at=CASE WHEN ${flag}::boolean THEN now() ELSE NULL END WHERE id=${key}::uuid RETURNING id`;
  if(!rows.length) throw new Error('Reader record not found'); return true;
}

export async function removeReader(id: string) {
  await requireTutor(); const key=uuid.parse(id);
  await sqlClient()`DELETE FROM student_books WHERE id=${key}::uuid`;
  return true;
}

/** Picks a random book for the class. The newest earlier pick for that class is excluded, so a class never gets the same book twice in a row. */
export async function pickBook(classroomId: string) {
  await requireTutor(); const classroom=uuid.parse(classroomId),sql=sqlClient();
  const rows=await sql`WITH last_pick AS (
    SELECT book_id FROM class_book_picks WHERE classroom_id=${classroom}::uuid ORDER BY picked_at DESC LIMIT 1
  ), chosen AS (
    SELECT b.id,b.title,b.series,b.level,b.cover_path,b.aspect::float AS aspect,b.position FROM books b
    WHERE b.active AND b.id IS DISTINCT FROM (SELECT book_id FROM last_pick)
    ORDER BY gen_random_bytes(32) LIMIT 1
  ), saved AS (
    INSERT INTO class_book_picks(classroom_id,book_id) SELECT ${classroom}::uuid,id FROM chosen RETURNING book_id
  )
  SELECT c.* FROM chosen c JOIN saved s ON s.book_id=c.id`;
  if(!rows.length) throw new Error('Add at least two active books before picking');
  return rows[0];
}

export async function createClassroom(input: string) {
  await requireTutor(); const value=name.parse(input); return (await sqlClient()`INSERT INTO classrooms(name) VALUES(${value}) RETURNING id,name`)[0];
}
export async function renameClassroom(id: string,input: string) {
  await requireTutor(); const key=uuid.parse(id),value=name.parse(input); const rows=await sqlClient()`UPDATE classrooms SET name=${value},updated_at=now() WHERE id=${key} AND archived_at IS NULL RETURNING id,name`; if(!rows.length) throw new Error('Classroom not found'); return rows[0];
}
export async function archiveClassroom(id: string) {
  await requireTutor(); const key=uuid.parse(id),sql=sqlClient();
  await sql`UPDATE classrooms SET archived_at=now(),updated_at=now() WHERE id=${key} AND archived_at IS NULL`;
  await sql`UPDATE groups SET archived_at=now(),updated_at=now() WHERE classroom_id=${key} AND archived_at IS NULL`;
  await sql`UPDATE students SET archived_at=now(),updated_at=now() WHERE group_id IN (SELECT id FROM groups WHERE classroom_id=${key}) AND archived_at IS NULL`;
}
export async function createGroup(classroomId: string,input: string,gradeLabel?: string) {
  await requireTutor(); const parent=uuid.parse(classroomId),value=name.parse(input),grade=gradeLabel?name.parse(gradeLabel):null;
  const rows=await sqlClient()`INSERT INTO groups(classroom_id,name,grade_label) SELECT id,${value},${grade} FROM classrooms WHERE id=${parent} AND archived_at IS NULL RETURNING id,name,classroom_id`;
  if(!rows.length) throw new Error('Active classroom not found'); return rows[0];
}
export async function archiveGroup(id: string) {
  await requireTutor(); const key=uuid.parse(id),sql=sqlClient();
  await sql`UPDATE groups SET archived_at=now(),updated_at=now() WHERE id=${key} AND archived_at IS NULL`;
  await sql`UPDATE students SET archived_at=now(),updated_at=now() WHERE group_id=${key} AND archived_at IS NULL`;
}
export async function createStudent(classroomId: string,displayName: string,avatarKey: string) {
  await requireTutor(); const classroom=uuid.parse(classroomId),person=name.parse(displayName),avatar=z.enum(avatarKeys).parse(avatarKey),sql=sqlClient();
  let groups=await sql`SELECT id FROM groups WHERE classroom_id=${classroom} AND archived_at IS NULL ORDER BY created_at,id LIMIT 1`;
  if(!groups.length) groups=await sql`INSERT INTO groups(classroom_id,name) SELECT id,'Class roster' FROM classrooms WHERE id=${classroom} AND archived_at IS NULL RETURNING id`;
  if(!groups.length) throw new Error('Active classroom not found');
  const rows=await sql`INSERT INTO students(group_id,display_name,avatar_key) VALUES(${groups[0].id},${person},${avatar}) RETURNING id,display_name,avatar_key,group_id`;
  return rows[0];
}
export async function archiveStudent(id: string) { await requireTutor(); const key=uuid.parse(id); await sqlClient()`UPDATE students SET archived_at=now(),updated_at=now() WHERE id=${key} AND archived_at IS NULL`; }
export async function updateStudent(id:string,displayName:string) { await requireTutor(); const key=uuid.parse(id),person=name.parse(displayName); const rows=await sqlClient()`UPDATE students SET display_name=${person},updated_at=now() WHERE id=${key} AND archived_at IS NULL RETURNING id,display_name`; if(!rows.length) throw new Error('Active student not found'); return rows[0]; }
export async function updateStudentAvatar(id:string,avatarKey:string) { await requireTutor(); const key=uuid.parse(id),avatar=z.enum(avatarKeys).parse(avatarKey); const rows=await sqlClient()`UPDATE students SET avatar_key=${avatar},updated_at=now() WHERE id=${key} AND archived_at IS NULL RETURNING id,avatar_key`; if(!rows.length) throw new Error('Active student not found'); return rows[0]; }
export async function createStudents(classroomId:string,displayNames:string[]) {
  await requireTutor(); const classroom=uuid.parse(classroomId),people=z.array(name).min(1).max(100).parse(displayNames),sql=sqlClient();
  let groups=await sql`SELECT id FROM groups WHERE classroom_id=${classroom} AND archived_at IS NULL ORDER BY created_at,id LIMIT 1`;
  if(!groups.length) groups=await sql`INSERT INTO groups(classroom_id,name) SELECT id,'Class roster' FROM classrooms WHERE id=${classroom} AND archived_at IS NULL RETURNING id`;
  if(!groups.length) throw new Error('Active classroom not found');
  const group=uuid.parse(String(groups[0].id));
  return sql`INSERT INTO students(group_id,display_name,avatar_key) SELECT ${group},person,avatars.avatar FROM unnest(${people}::text[]) WITH ORDINALITY AS names(person,n) CROSS JOIN LATERAL (SELECT (ARRAY['fox','bear','panda','lion','frog','tiger','koala','unicorn','penguin','octopus','dolphin','whale','turtle','butterfly','bee','ladybug','parrot','flamingo','peacock','rabbit','cat','dog','hamster','monkey','elephant','giraffe','zebra','crocodile','dinosaur','dragon','owl','chick','hedgehog','raccoon','squirrel','otter','seal','sloth','llama','deer','horse','mouse','wolf','bird','shell','star','rainbow','rocket','heart','sun','flower','cherry','cupcake','icecream','robot','alien'])[((n-1)%56)+1] AS avatar) avatars RETURNING id,display_name,avatar_key,group_id`;
}

export async function getGroupRoster(groupId: string,recordDate: string) {
  await requireTutor(); const group=uuid.parse(groupId),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(recordDate);
  return sqlClient()`SELECT s.id,s.display_name,s.avatar_key,br.criteria,br.updated_at FROM students s JOIN groups g ON g.id=s.group_id LEFT JOIN behavior_records br ON br.student_id=s.id AND br.record_date=${date} WHERE s.group_id=${group} AND s.archived_at IS NULL AND g.archived_at IS NULL ORDER BY s.display_name`;
}
export async function saveBehaviorRecord(studentId: string,groupId: string,recordDate: string,checks: unknown) {
  await requireTutor(); const student=uuid.parse(studentId),group=uuid.parse(groupId),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(recordDate),valid=criteriaSchema.parse(checks);
  const rows=await sqlClient()`INSERT INTO behavior_records(student_id,group_id,record_date,criteria) SELECT s.id,s.group_id,${date},${JSON.stringify(valid)}::jsonb FROM students s JOIN groups g ON g.id=s.group_id WHERE s.id=${student} AND s.group_id=${group} AND s.archived_at IS NULL AND g.archived_at IS NULL ON CONFLICT(student_id,record_date) DO UPDATE SET criteria=EXCLUDED.criteria,updated_at=now() WHERE behavior_records.group_id=EXCLUDED.group_id RETURNING id,criteria,updated_at`;
  if(!rows.length) throw new Error('Student is not active in this group'); return rows[0];
}

export async function createPrize(input: string,description?: string) {
  await requireTutor(); const prize=name.parse(input),detail=description?z.string().trim().max(500).parse(description):null;
  return (await sqlClient()`INSERT INTO prizes(name,description) VALUES(${prize},${detail}) RETURNING id,name,description,active`)[0];
}
export async function updatePrize(id: string,input: string,description?: string) {
  await requireTutor(); const key=uuid.parse(id),prize=name.parse(input),detail=description?z.string().trim().max(500).parse(description):null;
  const rows=await sqlClient()`UPDATE prizes SET name=${prize},description=${detail},updated_at=now() WHERE id=${key} RETURNING id,name,description,active`; if(!rows.length) throw new Error('Prize not found'); return rows[0];
}
export async function setPrizeActive(id: string,active: boolean) {
  await requireTutor(); const key=uuid.parse(id),state=z.boolean().parse(active); return (await sqlClient()`UPDATE prizes SET active=${state},updated_at=now() WHERE id=${key} RETURNING id,name,description,active`)[0];
}

export async function drawReward(input: {idempotencyKey:string;classroomId:string;studentId?:string;presentIds?:string[]}) {
  await requireTutor(); const key=uuid.parse(input.idempotencyKey),classroom=uuid.parse(input.classroomId),selected=input.studentId?uuid.parse(input.studentId):null,sql=sqlClient();
  // Roll call: when the tutor sends the ids of students who are here, only they can be drawn.
  const here=input.presentIds?z.array(uuid).max(500).parse(input.presentIds):null; if(here&&!here.length) throw new Error('Nobody is marked present'); const hereCsv=here?here.join(','):null;
  const existing=await sql`SELECT d.id,d.drawn_at,d.selection_mode,d.prize_name_snapshot AS prize,s.id AS student_id,s.display_name AS student,s.avatar_key FROM reward_draws d JOIN students s ON s.id=d.student_id WHERE d.idempotency_key=${key} LIMIT 1`;
  if(existing.length) return existing[0];
  const inserted=await sql`WITH chosen_student AS (
    SELECT s.id,s.display_name,s.avatar_key,s.group_id FROM students s JOIN groups g ON g.id=s.group_id
    WHERE g.classroom_id=${classroom} AND s.archived_at IS NULL AND g.archived_at IS NULL AND (${selected}::uuid IS NULL OR s.id=${selected}) AND (${hereCsv}::text IS NULL OR s.id = ANY(string_to_array(${hereCsv},',')::uuid[]))
    ORDER BY gen_random_bytes(32) LIMIT 1
  ), chosen_prize AS (
    SELECT id,name FROM prizes WHERE active=true ORDER BY gen_random_bytes(32) LIMIT 1
  ), saved AS (
    INSERT INTO reward_draws(idempotency_key,student_id,group_id,prize_id,prize_name_snapshot,selection_mode)
    SELECT ${key},s.id,s.group_id,p.id,p.name,${selected?'tutor_selected':'group_random'} FROM chosen_student s CROSS JOIN chosen_prize p
    ON CONFLICT(idempotency_key) DO NOTHING RETURNING id,drawn_at,selection_mode,prize_name_snapshot,student_id
  )
  SELECT saved.id,saved.drawn_at,saved.selection_mode,saved.prize_name_snapshot AS prize,saved.student_id,s.display_name AS student,s.avatar_key
  FROM saved JOIN students s ON s.id=saved.student_id`;
  if(inserted.length) return inserted[0];
  const retry=await sql`SELECT d.id,d.drawn_at,d.selection_mode,d.prize_name_snapshot AS prize,s.id AS student_id,s.display_name AS student,s.avatar_key FROM reward_draws d JOIN students s ON s.id=d.student_id WHERE d.idempotency_key=${key} LIMIT 1`;
  if(retry.length) return retry[0];
  const people=await sql`SELECT s.id FROM students s JOIN groups g ON g.id=s.group_id WHERE g.classroom_id=${classroom} AND s.archived_at IS NULL AND g.archived_at IS NULL AND (${selected}::uuid IS NULL OR s.id=${selected}) AND (${hereCsv}::text IS NULL OR s.id = ANY(string_to_array(${hereCsv},',')::uuid[])) LIMIT 1`;
  if(!people.length) throw new Error('Choose an active student or a classroom with active students');
  throw new Error('Add or activate a prize before drawing');
}

export async function getReport(classroomId: string,start: string,end: string) {
  await requireTutor(); const classroom=uuid.parse(classroomId),from=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(start),to=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(end);
  if(from>to) throw new Error('Invalid report date range');
  return sqlClient()`SELECT s.id,s.display_name,s.avatar_key,COALESCE(sum(((br.criteria->>'homework_complete')::boolean)::int+((br.criteria->>'class_participation')::boolean)::int+((br.criteria->>'speaking_effort')::boolean)::int+((br.criteria->>'project_complete')::boolean)::int+((br.criteria->>'class_readiness')::boolean)::int+((br.criteria->>'speaking_day_rules')::boolean)::int),0)::int AS total,COALESCE(sum(((br.criteria->>'homework_complete')::boolean)::int),0)::int AS homework_complete,COALESCE(sum(((br.criteria->>'class_participation')::boolean)::int),0)::int AS class_participation,COALESCE(sum(((br.criteria->>'speaking_effort')::boolean)::int),0)::int AS speaking_effort,COALESCE(sum(((br.criteria->>'project_complete')::boolean)::int),0)::int AS project_complete,COALESCE(sum(((br.criteria->>'class_readiness')::boolean)::int),0)::int AS class_readiness,COALESCE(sum(((br.criteria->>'speaking_day_rules')::boolean)::int),0)::int AS speaking_day_rules FROM students s JOIN groups g ON g.id=s.group_id LEFT JOIN behavior_records br ON br.student_id=s.id AND br.record_date BETWEEN ${from} AND ${to} WHERE g.classroom_id=${classroom} AND g.archived_at IS NULL AND s.archived_at IS NULL GROUP BY s.id ORDER BY s.display_name`;
}

export async function getPeriodReport(classroomId: string,period: 'week'|'month') {
  const tutor=await requireTutor();
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:tutor.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const [year,month,day]=today.split('-').map(Number);
  const localDate=new Date(Date.UTC(year,month-1,day));
  let start:Date,end:Date;
  if(period==='week') { const offset=(localDate.getUTCDay()+6)%7; start=new Date(localDate); start.setUTCDate(start.getUTCDate()-offset); end=new Date(start); end.setUTCDate(end.getUTCDate()+6); }
  else { start=new Date(Date.UTC(year,month-1,1)); end=new Date(Date.UTC(year,month,0)); }
  const iso=(date:Date)=>date.toISOString().slice(0,10),from=iso(start),to=iso(end);
  return {from,to,rows:await getReport(classroomId,from,to)};
}

/* ---------- Secret ballot ---------- */

/** Who a student has already nominated. The answer is only used to grey out those classmates on that student's own screen. */
export async function getBallot(classroomId: string, voterId?: string) {
  await requireTutor(); const classroom=uuid.parse(classroomId),sql=sqlClient();
  if(!voterId){ await sql`SELECT 1 FROM student_ballots WHERE classroom_id=${classroom}::uuid LIMIT 1`; return {nominated:[] as string[]}; }
  const rows=await sql`SELECT nominee_id FROM student_ballots WHERE voter_id=${uuid.parse(voterId)}::uuid`;
  return {nominated:rows.map(r=>String(r.nominee_id))};
}

/** Records one nomination. The database refuses a student nominating themselves or the same classmate twice. */
export async function castBallot(classroomId: string, voterId: string, nomineeId: string) {
  await requireTutor(); const classroom=uuid.parse(classroomId),voter=uuid.parse(voterId),nominee=uuid.parse(nomineeId);
  if(voter===nominee) throw new Error('You cannot choose yourself');
  const rows=await sqlClient()`INSERT INTO student_ballots(classroom_id,voter_id,nominee_id)
    SELECT ${classroom}::uuid,v.id,n.id FROM students v JOIN groups gv ON gv.id=v.group_id
    CROSS JOIN students n JOIN groups gn ON gn.id=n.group_id
    WHERE v.id=${voter}::uuid AND n.id=${nominee}::uuid AND gv.classroom_id=${classroom}::uuid AND gn.classroom_id=${classroom}::uuid
      AND v.archived_at IS NULL AND n.archived_at IS NULL
    ON CONFLICT (voter_id,nominee_id) DO NOTHING RETURNING id`;
  if(!rows.length) throw new Error('That classmate was already chosen');
  return true;
}

/** Teacher view: how many nominations each student received, never who chose whom. */
export async function getBallotResults(classroomId: string) {
  await requireTutor(); const classroom=uuid.parse(classroomId),sql=sqlClient();
  const tally=await sql`SELECT n.id,n.display_name AS student,n.avatar_key,count(*)::int AS votes
    FROM student_ballots b JOIN students n ON n.id=b.nominee_id WHERE b.classroom_id=${classroom}::uuid
    GROUP BY n.id,n.display_name,n.avatar_key ORDER BY votes DESC,n.display_name`;
  const voters=await sql`SELECT count(DISTINCT voter_id)::int AS voters FROM student_ballots WHERE classroom_id=${classroom}::uuid`;
  return {tally,voters:Number(voters[0]?.voters??0)};
}

export async function resetBallot(classroomId: string) {
  await requireTutor(); const classroom=uuid.parse(classroomId);
  await sqlClient()`DELETE FROM student_ballots WHERE classroom_id=${classroom}::uuid`;
  return true;
}
