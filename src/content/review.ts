import { getLessons, getLoaf, getLoaves, getPlacement, getQuiz } from './loader';

const LETTERS = 'ABCD';

function draftTag(draft: boolean): string {
  return draft ? ' _(draft)_' : '';
}

/**
 * One readable page of all learner-facing copy, for review.
 * `docs/content-review.md` is checked against this by a test.
 * Regenerate it with `npm run test -- -u`.
 */
export function renderContentReview(): string {
  const out: string[] = [];
  const placement = getPlacement();
  const loaf = getLoaf('emergency-fund');
  if (loaf.status !== 'built') throw new Error('emergency-fund must be a built loaf');

  out.push(
    '# Content review',
    '',
    'Generated from `content/` and `public/videos/`. Do not edit by hand: change the content, then run `npm run test -- -u` to regenerate. Items marked _(draft)_ are waiting for review.',
    '',
    `## Placement: ${placement.title}${draftTag(placement.draft)}`,
    '',
    placement.intro,
    '',
  );

  placement.questions.forEach((q, i) => {
    out.push(`### ${i + 1}. ${q.prompt}`, '');
    out.push(`_${q.kind === 'multi' ? 'Choose all that apply' : 'Choose one'}_`, '');
    if (q.help) out.push(`Help text: ${q.help}`, '');
    for (const o of q.options) out.push(`- ${o.label}`);
    out.push('');
  });

  out.push(`## Loaf: ${loaf.title}${draftTag(loaf.draft)}`, '');
  out.push(`${loaf.bread}. ${loaf.breadWhy}`, '', loaf.summary, '');
  out.push(
    `Target: ${loaf.targetMonths.default} month(s) by default. Choices: ${loaf.targetMonths.choices.join(', ')} months.`,
    '',
  );

  out.push('## Lessons', '');
  getLessons('emergency-fund').forEach((lesson, i) => {
    out.push(`### Lesson ${i + 1}: ${lesson.title}${draftTag(lesson.draft)}`, '');
    out.push(
      `Video: \`${lesson.videoUrl}\` (${lesson.durationSeconds} seconds). Captions: \`${lesson.captionsUrl}\`.`,
    );
    if (lesson.optionalFor) {
      out.push(`Optional for students who have: ${lesson.optionalFor}.`);
    }
    out.push('', lesson.summary, '');
  });

  const quiz = getQuiz('emergency-fund');
  out.push(`## Quiz${draftTag(quiz.draft)}`, '');
  quiz.questions.forEach((q, i) => {
    out.push(`### Question ${i + 1}: ${q.question}`, '');
    q.choices.forEach((c, j) => {
      out.push(`- ${LETTERS[j]}. ${c}${j === q.answer ? ' **(correct)**' : ''}`);
    });
    out.push('', `Explanation: ${q.explain}`, '');
    out.push(`Links to: lesson \`${q.lesson}\` at ${q.timestamp}s.`, '');
  });

  out.push('## Tips while the loaf rises', '');
  for (const tip of loaf.tips) {
    out.push(`### ${tip.title} (unlocks at ${tip.stage})`, '', tip.body, '');
  }

  out.push('## Coming soon', '');
  for (const l of getLoaves().filter((x) => x.status === 'coming-soon')) {
    out.push(`### ${l.title}${draftTag(l.draft)}`, '', `${l.bread}. ${l.breadWhy}`, '', l.summary, '');
    if (l.status === 'coming-soon' && l.note) out.push(`Note: ${l.note}`, '');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
