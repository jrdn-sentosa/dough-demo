import { describe, expect, it } from 'vitest';
import pointsJson from '../../content/points.json';
import settingsJson from '../../content/settings.json';
import { POINT_KINDS } from '../domain/points';
import { ContentError } from './guards';
import { getPoints, getSettings, parsePoints } from './loader';

/** Every learner-facing string in the file, flattened. */
function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

describe('content/points.json', () => {
  it('carries a draft flag and loads', () => {
    expect(typeof getPoints().draft).toBe('boolean');
  });

  it('has a reason for every kind of point, and nothing else', () => {
    expect(Object.keys(pointsJson.history.reasons).sort()).toEqual([...POINT_KINDS].sort());
  });

  it('refuses content that is missing a reason', () => {
    const reasons: Record<string, string> = { ...pointsJson.history.reasons };
    delete reasons.quiz;
    expect(() => parsePoints({ ...pointsJson, history: { ...pointsJson.history, reasons } })).toThrow(ContentError);
  });

  it('only uses placeholders the screens fill in', () => {
    const c = getPoints();
    const allowed = (text: string, ...names: string[]) =>
      expect(placeholders(text).every((n) => names.includes(n))).toBe(true);
    allowed(c.home.linkLabel, 'points');
    allowed(c.history.total, 'points');
    allowed(c.history.earned, 'points');
    allowed(c.daily.right, 'points');
    allowed(c.history.reasons['fund-day'], 'date');
    allowed(c.history.reasons.video, 'lesson');
    allowed(c.history.reasons.mastery, 'loaf');
    allowed(c.history.reasons.bake, 'loaf');
  });

  it('never uses guilt words and never mentions a day without a point', () => {
    const guilt =
      /\b(lost|lose|loses|losing|broke|broken|break|breaks|failed|fail|fails|failure|missed|miss|missing|shame|punish\w*|skipped|no points?|didn't earn|zero|behind|streak)\b/i;
    for (const text of allStrings(pointsJson)) expect(text).not.toMatch(guilt);
  });

  it('keeps figures out of the copy: every number comes from the app', () => {
    for (const text of allStrings(pointsJson)) expect(text).not.toMatch(/\d/);
  });

  it('says points are not money, and promises nothing of value', () => {
    expect(pointsJson.history.demoNote).toMatch(/aren't money/);
    for (const text of allStrings(pointsJson)) expect(text).not.toMatch(/\b(redeem|prize|reward|cash|discount|gift)\b/i);
  });
});

describe('the feedback copy in content/settings.json', () => {
  const feedback = settingsJson.feedback;

  it('loads and fills only known placeholders', () => {
    const c = getSettings().feedback;
    const allowed = (text: string, ...names: string[]) =>
      expect(placeholders(text).every((n) => names.includes(n))).toBe(true);
    allowed(c.counter, 'count', 'max');
    allowed(c.emailVersion, 'version');
    allowed(c.emailScreen, 'screen');
    allowed(c.emailKind, 'category');
    allowed(c.version, 'version');
  });

  it('asks people to keep financial details out', () => {
    expect(feedback.privacy).toMatch(/account numbers/i);
    expect(feedback.privacy).toMatch(/financial details/i);
  });

  it('has a plausible email address for the demo mailto link', () => {
    expect(feedback.emailTo).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
