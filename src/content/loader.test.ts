import { describe, expect, it } from 'vitest';
import { ESSENTIALS_BANDS, SAVINGS_BANDS } from '../domain/bands';
import { MASTERY_PERCENT } from '../domain/mastery';
import { GROW_TARGET_MONTHS } from '../domain/recommendations';
import {
  ACCOUNT_TYPES,
  getComingSoonLoaves,
  getLesson,
  getLessons,
  getLoaf,
  getLoaves,
  getPlacement,
  getQuiz,
  parseLesson,
  parseLoaf,
  parseQuiz,
} from './loader';
import { ContentError } from './guards';
import { flattenCopy, renderContentReview } from './review';
import { fillTemplate } from './template';
import { DEFAULT_GOAL_CENTS } from '../domain/bands';

const captionFiles = import.meta.glob<string>('/public/videos/*/*.vtt', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const ids = (q: string) => getPlacement().questions.find((x) => x.id === q)?.options.map((o) => o.id);

/** All learner-facing prose in the emergency fund loaf, for the content-rule checks. */
function proseOf(loafId: 'emergency-fund'): string[] {
  const loaf = getLoaf(loafId);
  if (loaf.status !== 'built') return [];
  return [
    loaf.summary,
    ...loaf.tips.flatMap((t) => [t.title, t.body]),
    ...Object.values(loaf.flow.lessons),
    ...Object.values(loaf.flow.lesson),
    ...Object.values(loaf.flow.quiz),
    ...flattenCopy(loaf.flow.savingSetup).map(([, text]) => text),
    ...flattenCopy(loaf.flow.home).map(([, text]) => text),
    ...getLessons(loafId).flatMap((l) => [l.title, l.summary]),
    ...getQuiz(loafId).questions.flatMap((q) => [q.question, ...q.choices.map((c) => c.label), q.explain]),
    ...Object.entries(captionFiles).map(([, text]) => text),
  ];
}

describe('placement content', () => {
  const placement = getPlacement();

  it('has the 5 situation questions in order', () => {
    expect(placement.questions.map((q) => q.id)).toEqual([
      'essentials',
      'existing-savings',
      'accounts',
      'card-debt',
      'earned-income',
    ]);
  });

  it('uses the band ids from the domain constants', () => {
    expect(ids('essentials')).toEqual(ESSENTIALS_BANDS.map((b) => b.id));
    expect(ids('existing-savings')).toEqual(SAVINGS_BANDS.map((b) => b.id));
  });

  it('lists every account type, and only accounts is multi-select', () => {
    expect([...(ids('accounts') ?? [])].sort()).toEqual([...ACCOUNT_TYPES].sort());
    expect(placement.questions.filter((q) => q.kind === 'multi').map((q) => q.id)).toEqual(['accounts']);
  });

  it('has the card debt and income answers the domain expects', () => {
    expect(ids('card-debt')).toEqual(['yes', 'no', 'no-card']);
    expect(ids('earned-income')).toEqual(['yes', 'no']);
  });

  it('explains what to count as essentials', () => {
    const q = placement.questions[0];
    expect(q.help).toContain('prepaid');
  });

  it('has a boolean draft flag', () => {
    expect(typeof placement.draft).toBe('boolean');
  });

  it('says placement is quick and can be skipped', () => {
    expect(placement.intro).toBe(
      'A few quick questions to set your first goal. There are no right answers, and you can skip anytime.',
    );
  });

  it('has the skip button, its confirmation, and the skipped result copy', () => {
    expect(placement.skip.label).toBe('Skip for now');
    expect([placement.skip.confirmSkip, placement.skip.confirmKeep]).toEqual(['Skip', 'Keep answering']);
    expect(placement.skip.confirm).toContain('You can personalize anytime in Settings.');
    expect(placement.resultSkipped).toContain('Your first loaf: Emergency fund.');
  });

  it('uses a {goal} token instead of a typed figure, so the copy cannot drift from the default goal', () => {
    for (const text of [placement.skip.confirm, placement.resultSkipped]) {
      expect(text).toContain('{goal}');
      expect(text).not.toMatch(/\$\s?\d/);
    }
    const shown = fillTemplate(placement.resultSkipped, { goal: '$1,000' });
    expect(shown).toBe(
      'Your first loaf: Emergency fund. Starting goal: $1,000, a default you can change in Settings.',
    );
    expect(DEFAULT_GOAL_CENTS).toBe(100_000);
  });

  it('has the retake goal prompt and the ChooseLoaf personalization prompt', () => {
    expect(placement.retake.updateGoal).toBe('Update your goal to {amount}?');
    expect(placement.personalizePrompt).toBe('Answer a few quick questions for a personalized pick');
  });
});

describe('fillTemplate', () => {
  it('fills tokens, and throws on an unknown one', () => {
    expect(fillTemplate('Goal {goal}, again {goal}', { goal: '$1' })).toBe('Goal $1, again $1');
    expect(() => fillTemplate('Hello {nope}', {})).toThrow(/nope/);
  });
});

describe('loaf content', () => {
  it('defines all five loaves, with only the emergency fund built', () => {
    expect(getLoaves().map((l) => l.id)).toEqual([
      'emergency-fund',
      'index-funds',
      'bonds',
      'roth-ira',
      'debt-payoff',
    ]);
    expect(getLoaves().filter((l) => l.status === 'built').map((l) => l.id)).toEqual(['emergency-fund']);
    expect(getComingSoonLoaves()).toHaveLength(4);
  });

  it('has a boolean draft flag on every loaf', () => {
    for (const l of getLoaves()) expect(typeof l.draft).toBe('boolean');
  });

  it('has the 4 stage tips, in stage order', () => {
    const loaf = getLoaf('emergency-fund');
    if (loaf.status !== 'built') throw new Error('expected built');
    expect(loaf.tips.map((t) => t.stage)).toEqual(['shape', 'proof', 'bake', 'baked']);
    expect(loaf.tips.map((t) => t.title)).toEqual([
      'Why small deposits add up',
      'Make it automatic',
      "When it's the right time to use it",
      'Choosing your next loaf',
    ]);
  });

  it('has a "Grow your cushion" option that matches the recommendation logic', () => {
    const loaf = getLoaf('emergency-fund');
    if (loaf.status !== 'built') throw new Error('expected built');
    expect(loaf.growOption.title).toBe('Grow your cushion to 3 months');
    expect(loaf.growOption.targetMonths).toBe(GROW_TARGET_MONTHS);
  });

  it('asks for essentials first when growing with unknown essentials', () => {
    const loaf = getLoaf('emergency-fund');
    if (loaf.status !== 'built') throw new Error('expected built');
    expect(loaf.growOption.askEssentials).toBe('To size your 3-month goal, about how much do you need each month?');
  });

  it('offers 1, 3 and 6 months, defaulting to 1', () => {
    const loaf = getLoaf('emergency-fund');
    if (loaf.status !== 'built') throw new Error('expected built');
    expect(loaf.targetMonths).toEqual({ default: 1, choices: [1, 3, 6] });
  });
});

describe('lesson content', () => {
  const lessons = getLessons('emergency-fund');

  it('has the 3 lessons in order', () => {
    expect(lessons.map((l) => l.id)).toEqual(['ef-what-its-for', 'ef-how-much', 'ef-where-to-keep']);
  });

  it('keeps each video under 2 minutes', () => {
    for (const l of lessons) expect(l.durationSeconds).toBeLessThan(120);
  });

  it('marks only where-to-keep optional, for high-yield savings', () => {
    expect(lessons.map((l) => l.optionalFor)).toEqual([null, null, 'high-yield-savings']);
  });

  it('points at caption files that exist and are WebVTT', () => {
    for (const l of lessons) {
      const text = captionFiles[`/public${l.captionsUrl}`];
      expect(text, l.captionsUrl).toBeDefined();
      expect(text.startsWith('WEBVTT')).toBe(true);
    }
  });

  it('has a boolean draft flag', () => {
    for (const l of lessons) expect(typeof l.draft).toBe('boolean');
  });

  it('throws for an unknown lesson', () => {
    expect(() => getLesson('emergency-fund', 'nope')).toThrow(ContentError);
  });
});

describe('quiz content', () => {
  const quiz = getQuiz('emergency-fund');
  const lessons = getLessons('emergency-fund');

  it('has 5 questions with 3 or 4 choices and a valid answer', () => {
    expect(quiz.questions).toHaveLength(5);
    for (const q of quiz.questions) {
      expect(q.choices.length).toBeGreaterThanOrEqual(3);
      expect(q.choices.length).toBeLessThanOrEqual(4);
      expect(q.choices.map((c) => c.id)).toContain(q.answer);
      expect(q.explain.length).toBeGreaterThan(0);
    }
  });

  it('gives every choice an id that is unique within its question', () => {
    for (const q of quiz.questions) {
      const ids = q.choices.map((c) => c.id);
      for (const id of ids) expect(id, `${q.id} choice id`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(new Set(ids).size, q.id).toBe(ids.length);
    }
  });

  it('has an answer id that is one of the question\'s choice ids', () => {
    for (const q of quiz.questions) {
      expect(typeof q.answer).toBe('string');
      expect(q.choices.map((c) => c.id), q.id).toContain(q.answer);
    }
  });

  it('has unique question ids', () => {
    const qids = quiz.questions.map((q) => q.id);
    expect(new Set(qids).size).toBe(qids.length);
  });

  it('links every question to a real lesson and a timestamp inside it', () => {
    for (const q of quiz.questions) {
      const lesson = lessons.find((l) => l.id === q.lesson);
      expect(lesson, q.id).toBeDefined();
      expect(q.timestamp).toBeGreaterThanOrEqual(0);
      expect(q.timestamp).toBeLessThanOrEqual(lesson?.durationSeconds ?? 0);
    }
  });

  it('covers every lesson, so a missed question can recommend any of them', () => {
    expect(new Set(quiz.questions.map((q) => q.lesson))).toEqual(new Set(lessons.map((l) => l.id)));
  });

  it('has mastery copy that matches the mastery bar', () => {
    const loaf = getLoaf('emergency-fund');
    if (loaf.status !== 'built') throw new Error('expected built');
    const needed = (quiz.questions.length * MASTERY_PERCENT) / 100;
    expect(loaf.flow.quiz.masteryHint).toContain(`${needed} out of ${quiz.questions.length}`);
    expect(loaf.flow.quiz.mastered).toBe("You mastered this loaf's lessons.");
    expect(loaf.flow.lessons.mastered).toBe('Mastered');
  });

  it('is the quiz the loaf points to', () => {
    const loaf = getLoaf('emergency-fund');
    if (loaf.status !== 'built') throw new Error('expected built');
    expect(quiz.loaf).toBe(loaf.id);
    expect(loaf.quiz).toBe('emergency-fund');
  });

  it('has a boolean draft flag', () => {
    expect(typeof quiz.draft).toBe('boolean');
  });
});

describe('financial content rules', () => {
  const prose = proseOf('emergency-fund');

  it('has no dollar figures or percentages that will go stale', () => {
    for (const text of prose) {
      expect(text).not.toMatch(/\$\s?\d/);
      expect(text).not.toMatch(/\d\s?%/);
      expect(text).not.toMatch(/\bAPY\b/i);
    }
  });

  it('names no specific banks, credit unions, or apps', () => {
    const names =
      /\b(chase|ally|marcus|capital one|sofi|wells fargo|bank of america|citi|discover|fidelity|vanguard|schwab|robinhood|venmo|cash app|paypal|chime|american express)\b/i;
    for (const text of prose) expect(text).not.toMatch(names);
  });

  it('mentions FDIC (banks) and NCUA (credit unions) when explaining where to keep it', () => {
    const lesson = getLesson('emergency-fund', 'ef-where-to-keep');
    expect(lesson.summary).toContain('FDIC');
    expect(lesson.summary).toContain('NCUA');
    const captions = captionFiles['/public/videos/emergency-fund/ef-where-to-keep.vtt'];
    expect(captions).toContain('FDIC');
    expect(captions).toContain('NCUA');
  });

  it('names the FDIC and NCUA in the high-yield account step, and lists the lesson\'s "what to look for" points', () => {
    const loaf = getLoaf('emergency-fund');
    if (loaf.status !== 'built') throw new Error('built loaf expected');
    const points = loaf.flow.savingSetup.hysa.points.join(' ');
    expect(points).toContain('FDIC');
    expect(points).toContain('NCUA');
    expect(points).toMatch(/fees/i);
    expect(points).toMatch(/minimum balance/i);
    expect(points).toMatch(/access/i);
    const lesson = getLesson('emergency-fund', 'ef-where-to-keep').summary;
    expect(lesson).toMatch(/Low or no fees/);
    expect(lesson).toMatch(/hard to meet/);
  });

  it('says what happens when the questions are skipped, with no dollar figure', () => {
    const sentence = 'If you skip the questions, it starts with a common starter goal.';
    expect(getLesson('emergency-fund', 'ef-how-much').summary).toContain(sentence);
    expect(captionFiles['/public/videos/emergency-fund/ef-how-much.vtt']).toContain(sentence);
  });

  it('warns about transfer time and about apps that are not banks', () => {
    const summary = getLesson('emergency-fund', 'ef-where-to-keep').summary;
    expect(summary).toContain('can take a day or two');
    expect(summary).toContain('Not every app is a bank.');
    const captions = captionFiles['/public/videos/emergency-fund/ef-where-to-keep.vtt'];
    expect(captions).toContain('can take a day or two');
    expect(captions).toContain('Not every app is a bank.');
  });

  it('keeps each lesson summary to about a 2-minute read', () => {
    for (const l of getLessons('emergency-fund')) {
      const words = l.summary.split(/\s+/).length;
      expect(words, l.id).toBeLessThanOrEqual(300);
    }
  });
});

const choicesOf = (...ids: string[]) => ids.map((id) => ({ id, label: id.toUpperCase() }));

describe('malformed content throws', () => {
  it('rejects a quiz whose answer is out of range', () => {
    const bad = {
      draft: true,
      loaf: 'emergency-fund',
      questions: [
        { id: 'x', question: 'q', choices: choicesOf('a', 'b', 'c'), answer: 'd', explain: 'e', lesson: 'l', timestamp: 1 },
      ],
    };
    expect(() => parseQuiz(bad, 'quiz.json')).toThrow(/answer/);
  });

  it('rejects a quiz whose answer is a position instead of a choice id', () => {
    const bad = {
      draft: true,
      loaf: 'emergency-fund',
      questions: [{ id: 'x', question: 'q', choices: choicesOf('a', 'b', 'c'), answer: 1, explain: 'e', lesson: 'l', timestamp: 1 }],
    };
    expect(() => parseQuiz(bad, 'quiz.json')).toThrow(ContentError);
  });

  it('rejects a question with two choices that share an id', () => {
    const bad = {
      draft: true,
      loaf: 'emergency-fund',
      questions: [{ id: 'x', question: 'q', choices: choicesOf('a', 'b', 'a'), answer: 'a', explain: 'e', lesson: 'l', timestamp: 1 }],
    };
    expect(() => parseQuiz(bad, 'quiz.json')).toThrow(/unique/);
  });

  it('rejects a choice with no id', () => {
    const bad = {
      draft: true,
      loaf: 'emergency-fund',
      questions: [{ id: 'x', question: 'q', choices: [{ label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }], answer: 'b', explain: 'e', lesson: 'l', timestamp: 1 }],
    };
    expect(() => parseQuiz(bad, 'quiz.json')).toThrow(ContentError);
  });

  it('rejects a loaf with a non-boolean draft flag', () => {
    const bad = {
      status: 'coming-soon',
      id: 'bonds',
      draft: 'yes',
      title: 'Bonds',
      bread: 'Rye loaf',
      breadWhy: 'w',
      summary: 's',
    };
    expect(() => parseLoaf(bad, 'bonds.json')).toThrow(/draft/);
  });

  it('rejects a lesson with no summary body', () => {
    const src = '---\nid: a\ntitle: A\ndraft: true\nvideo: a.mp4\ncaptions: a.vtt\ndurationSeconds: 10\n---\n';
    expect(() => parseLesson(src, '../../content/lessons/emergency-fund/a.md')).toThrow(/summary/);
  });

  it('rejects a lesson outside a loaf folder', () => {
    expect(() => parseLesson('---\nid: a\n---\nbody', 'content/lessons/a.md')).toThrow(ContentError);
  });
});

describe('docs/content-review.md', () => {
  it('matches the content. Run `npx vitest run -u` to regenerate it', async () => {
    await expect(renderContentReview()).toMatchFileSnapshot('../../docs/content-review.md');
  });
});
