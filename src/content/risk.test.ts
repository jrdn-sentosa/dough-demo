import { describe, expect, it } from 'vitest';
import { DROP_REACTIONS, EXPERIENCES, HORIZONS, PRIORITIES, RISK_QUESTION_IDS } from '../domain/risk';
import { ContentError } from './guards';
import { getRisk, parseRisk } from './loader';
import { flattenCopy } from './review';
import { fillTemplate } from './template';

const risk = getRisk();
const raw = (): Record<string, unknown> => JSON.parse(JSON.stringify(risk)) as Record<string, unknown>;

describe('risk quiz content', () => {
  it('has the 4 questions in order, with option ids that match the domain', () => {
    expect(risk.questions.map((q) => q.id)).toEqual([...RISK_QUESTION_IDS]);
    const ids = (q: string) => risk.questions.find((x) => x.id === q)?.options.map((o) => o.id);
    expect(ids('horizon')).toEqual([...HORIZONS]);
    expect(ids('drop')).toEqual([...DROP_REACTIONS]);
    expect(ids('priority')).toEqual([...PRIORITIES]);
    expect(ids('experience')).toEqual([...EXPERIENCES]);
  });

  it('asks the questions as written in the brief', () => {
    expect(risk.questions[0].prompt).toBe('When might you need this money?');
    expect(risk.questions[0].options.map((o) => o.label)).toEqual([
      'Within a year',
      'In 1 to 3 years',
      'In 3 to 5 years',
      'In more than 5 years',
    ]);
    expect(risk.questions[1].options.map((o) => o.label)).toEqual(['Sell everything', 'Sell some', 'Wait it out', 'Add more']);
    expect(risk.questions[2].options).toHaveLength(3);
    expect(risk.questions[3].options.map((o) => o.label)).toEqual(['No', 'A little', 'Yes']);
  });

  it('is framed as a way to see what fits, with no right answers, and is skippable', () => {
    expect(risk.intro).toContain('no right answers');
    expect(risk.skip.label).toBe('Skip for now');
    expect(risk.skip.confirm).toContain('most cautious');
  });

  it('has no dollar figures, percentages, allocations, fund names or brand names', () => {
    const text = flattenCopy(risk).map(([, t]) => t);
    for (const t of text) {
      expect(t).not.toMatch(/\$\s?\d/);
      expect(t).not.toMatch(/\d\s?%/);
      expect(t).not.toMatch(/\b(percent|allocation|portfolio mix)\b/i);
      expect(t).not.toMatch(/\b(vanguard|fidelity|schwab|robinhood|blackrock|ishares|spdr|s&p|etf)\b/i);
    }
  });

  it('is educational, never an instruction', () => {
    const r = risk.result;
    expect(r.educational).toContain('not financial advice');
    expect(r.approach.steady.body).toContain("Here's what a steadier approach looks like and why");
    for (const t of flattenCopy(r).map(([, x]) => x)) expect(t).not.toMatch(/\byou should (buy|sell|invest)\b/i);
  });

  it('mentions the knowledge check that still applies before any investing loaf', () => {
    expect(risk.result.knowledgeCheck).toContain('4 out of 5');
  });

  it('explains a Roth IRA as an account that holds the investments', () => {
    expect(risk.result.where['roth-ira'].body).toContain('account that holds your investments');
  });

  it('fills its loaf line tokens', () => {
    expect(fillTemplate(risk.result.loafLine, { loaf: 'Bonds', bread: 'Rye loaf' })).toBe('The loaf that fits: Bonds (Rye loaf).');
  });

  it('throws on malformed content', () => {
    const noResult = raw();
    delete noResult.result;
    expect(() => parseRisk(noResult)).toThrow(ContentError);
    const swapped = raw() as { questions: unknown[] };
    swapped.questions = [...swapped.questions].reverse();
    expect(() => parseRisk(swapped)).toThrow(/in order/);
    const missing = raw() as { result: { startSmall?: string } };
    delete missing.result.startSmall;
    expect(() => parseRisk(missing)).toThrow(/startSmall/);
  });
});
