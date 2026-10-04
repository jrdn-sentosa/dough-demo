import { describe, expect, it } from 'vitest';

const files = import.meta.glob<string>('../../supabase/migrations/*.sql', { eager: true, query: '?raw', import: 'default' });
const sql = Object.keys(files)
  .sort()
  .map((f) => files[f])
  .join('\n');

const tables = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/gi)].map((m) => m[1]);

describe('Supabase migrations', () => {
  it('create the tables the app needs', () => {
    expect(tables.sort()).toEqual(['lesson_progress', 'loaves', 'profiles', 'quiz_attempts', 'transactions', 'user_state']);
  });

  it.each(tables)('%s has Row Level Security and an own-rows policy', (table) => {
    expect(sql).toMatch(new RegExp(`alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`, 'i'));
    const policy = new RegExp(`create\\s+policy\\s+"[^"]+"\\s+on\\s+(?:public\\.)?${table}\\s+for\\s+all\\s+to\\s+authenticated\\s+using\\s*\\(\\s*user_id\\s*=\\s*\\(select auth\\.uid\\(\\)\\)\\s*\\)\\s*with\\s+check\\s*\\(\\s*user_id\\s*=\\s*\\(select auth\\.uid\\(\\)\\)\\s*\\)`, 'i');
    expect(sql).toMatch(policy);
  });

  it.each(tables)('%s has a user_id column that cascades from auth.users', (table) => {
    const body = sql.match(new RegExp(`create\\s+table\\s+public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'))?.[1] ?? '';
    expect(body).toMatch(/user_id\s+uuid[^,]*references\s+auth\.users\s*\(id\)\s+on\s+delete\s+cascade/i);
  });

  it('never stores a balance', () => {
    const code = sql.replace(/--.*$/gm, '');
    expect(code).not.toMatch(/balance/i);
  });

  it('takes everything away from signed-out visitors', () => {
    expect(sql).toMatch(/revoke\s+all\s+on[\s\S]*from\s+anon/i);
  });
});
