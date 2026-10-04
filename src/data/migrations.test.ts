import { describe, expect, it } from 'vitest';

const files = import.meta.glob<string>('../../supabase/migrations/*.sql', { eager: true, query: '?raw', import: 'default' });
const sql = Object.keys(files)
  .sort()
  .map((f) => files[f])
  .join('\n');

const tables = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/gi)].map((m) => m[1]);

describe('Supabase migrations', () => {
  it('create the tables the app needs', () => {
    expect([...tables].sort()).toEqual([
      'daily_quizzes',
      'feedback',
      'lesson_progress',
      'loaves',
      'point_events',
      'profiles',
      'quiz_attempts',
      'transactions',
      'user_state',
    ]);
  });

  /** Tables that deliberately allow less than everything on a user's own rows. */
  const limited: Record<string, readonly ('select' | 'insert')[]> = {
    point_events: ['select', 'insert'],
    feedback: ['insert'],
  };

  const own = String.raw`user_id\s*=\s*\(select auth\.uid\(\)\)`;
  const policiesOn = (table: string) =>
    [...sql.matchAll(new RegExp(String.raw`create\s+policy\s+"[^"]+"\s+on\s+(?:public\.)?${table}\s+for\s+(\w+)\s+to\s+authenticated([^;]*);`, 'gi'))].map(
      (m) => ({ command: m[1].toLowerCase(), body: m[2] }),
    );

  it.each(tables)('%s has Row Level Security and an own-rows policy', (table) => {
    expect(sql).toMatch(new RegExp(`alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`, 'i'));
    const policies = policiesOn(table);
    const commands = limited[table] ?? ['all'];
    expect(policies.map((p) => p.command).sort()).toEqual([...commands].sort());
    for (const p of policies) {
      // Every policy limits rows to the signed-in user: reads by `using`, writes by `with check`.
      const reads = p.command === 'select' || p.command === 'all';
      const writes = p.command === 'insert' || p.command === 'all';
      if (reads) expect(p.body).toMatch(new RegExp(String.raw`using\s*\(\s*${own}\s*\)`, 'i'));
      if (writes) expect(p.body).toMatch(new RegExp(String.raw`with\s+check\s*\(\s*${own}\s*\)`, 'i'));
    }
  });

  it('lets feedback be sent but never read, and points be added but never changed or removed', () => {
    const grantsTo = (table: string) =>
      [...sql.matchAll(/grant\s+([\w,\s]+?)\s+on\s+([^;]*?)\s+to\s+authenticated\s*;/gi)]
        .filter((m) => new RegExp(`(?:public\\.)?${table}\\b`).test(m[2]))
        .flatMap((m) => m[1].split(',').map((s) => s.trim().toLowerCase()));
    expect(grantsTo('feedback')).toEqual(['insert']);
    expect(grantsTo('point_events').sort()).toEqual(['insert', 'select']);
    expect(sql).toMatch(/revoke\s+all\s+on\s+public\.point_events,\s*public\.feedback\s+from\s+authenticated/i);
  });

  it('limits the feedback message length in the database too', () => {
    expect(sql).toMatch(/char_length\(btrim\(message\)\)\s+between\s+1\s+and\s+1000/i);
  });

  it.each(tables)('%s has a user_id column that cascades from auth.users', (table) => {
    const body = sql.match(new RegExp(`create\\s+table\\s+public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'))?.[1] ?? '';
    expect(body).toMatch(/user_id\s+uuid[^,]*references\s+auth\.users\s*\(id\)\s+on\s+delete\s+cascade/i);
  });

  it('never stores a balance', () => {
    const code = sql.replace(/--.*$/gm, '');
    expect(code).not.toMatch(/balance/i);
  });

  it('moves the daily quiz to a list of questions per day, keeping old days, and allows the bonus point', () => {
    const code = sql.replace(/--.*$/gm, '');
    expect(code).toMatch(/alter\s+table\s+public\.daily_quizzes\s+add\s+column\s+questions\s+jsonb/i);
    // Days saved with one question stay valid: their columns become optional and are copied into the list.
    expect(code).toMatch(/alter\s+column\s+loaf_id\s+drop\s+not\s+null/i);
    expect(code).toMatch(/alter\s+column\s+question_id\s+drop\s+not\s+null/i);
    expect(code).toMatch(/update\s+public\.daily_quizzes\s+set\s+questions\s*=/i);
    expect(code).toMatch(/kind\s+in\s*\([^)]*'quiz'[^)]*'quiz-bonus'[^)]*\)/i);
    expect(code).toMatch(/alter\s+table\s+public\.user_state\s+add\s+column\s+daily_quiz_popup\s+jsonb/i);
  });

  it('takes everything away from signed-out visitors', () => {
    expect(sql).toMatch(/revoke\s+all\s+on[\s\S]*from\s+anon/i);
  });
});
