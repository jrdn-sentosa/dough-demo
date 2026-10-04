import { describe, expect, it } from 'vitest';
import breadsJson from '../../content/breads.json';
import { BREAD_IDS, LADDER, UNLOCKABLE_BREADS } from '../domain/breads';
import { ContentError } from './guards';
import { getBreads, parseBreads } from './loader';

/** Every learner-facing string in the file, flattened. */
function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

describe('content/breads.json', () => {
  it('names exactly the known bread ids, no more and no fewer', () => {
    expect(Object.keys(breadsJson.names).sort()).toEqual([...BREAD_IDS].sort());
  });

  it('has a name for every bread in the loaded content, and the ladder breads are all unlockable ids', () => {
    const { names } = getBreads();
    for (const id of BREAD_IDS) expect(names[id].trim()).not.toBe('');
    expect(LADDER.map((r) => r.bread)).toEqual([...UNLOCKABLE_BREADS]);
  });

  it('refuses content that is missing a bread name', () => {
    const names: Record<string, string> = { ...breadsJson.names };
    delete names.baguette;
    expect(() => parseBreads({ ...breadsJson, names })).toThrow(ContentError);
  });

  it('carries a draft flag', () => {
    expect(typeof getBreads().draft).toBe('boolean');
  });

  it('fills every template with the placeholders the screens pass', () => {
    const c = getBreads();
    const fill = (text: string, ...names: string[]) => {
      const found = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      expect(found.every((n) => names.includes(n))).toBe(true);
    };
    fill(c.streak.valueWeek, 'count');
    fill(c.streak.valuePayPeriod, 'count');
    fill(c.streak.valueMonth, 'count');
    fill(c.streak.weeksPill, 'weeks');
    fill(c.streak.startNext, 'bread', 'weeks');
    fill(c.streak.unlockedNext, 'bread', 'next', 'weeks');
    fill(c.streak.resetBody, 'bread', 'weeks');
    fill(c.unlock.title, 'bread');
    fill(c.picker.locked, 'count');
    fill(c.picker.button, 'bread');
  });

  it('never uses guilt words, and a streak that starts over reads as a fresh start', () => {
    const words = /\b(lost|lose|loses|losing|broke|broken|break|breaks|failed|fail|fails|failure|missed|miss|shame|punish\w*)\b/i;
    for (const text of allStrings(breadsJson)) expect(text).not.toMatch(words);
    const { streak } = getBreads();
    expect(streak.resetValue).toBe('New streak starts now.');
    expect(streak.resetBody).toMatch(/stay yours/);
    expect(streak.resetAllUnlocked).toMatch(/stay yours/);
  });

  it('names no brands, rates or dollar figures', () => {
    for (const text of allStrings(breadsJson)) expect(text).not.toMatch(/[$%]|\d+\s?%/);
  });
});
