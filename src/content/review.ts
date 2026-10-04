import { DEFAULT_GOAL_CENTS } from '../domain/bands';
import { formatCents } from '../money/format';
import { getLessons, getLoaf, getLoaves, getPlacement, getQuiz, getRisk } from './loader';
import { fillTemplate } from './template';

const LETTERS = 'ABCD';

function draftTag(draft: boolean): string {
  return draft ? ' _(draft)_' : '';
}

/** Fills `{goal}` with the starter goal as the app shows it, and any other tokens given. */
function fill(text: string, extra: Record<string, string> = {}): string {
  return fillTemplate(text, { goal: formatCents(DEFAULT_GOAL_CENTS), ...extra });
}

/** Nested screen copy as [dotted.key, text] lines. Lists become one line, items separated by " / ". */
export function flattenCopy(value: unknown, prefix = ''): [string, string][] {
  if (typeof value === 'string') return [[prefix, value]];
  if (Array.isArray(value)) return [[prefix, value.join(' / ')]];
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([k, v]) => flattenCopy(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

/**
 * One readable page of all learner-facing copy, for review.
 * `docs/content-review.md` is checked against this by a test.
 * Regenerate it with `npx vitest run -u`.
 */
export function renderContentReview(): string {
  const out: string[] = [];
  const placement = getPlacement();
  const loaf = getLoaf('emergency-fund');
  if (loaf.status !== 'built') throw new Error('emergency-fund must be a built loaf');

  out.push(
    '# Content review',
    '',
    'Generated from `content/` and `public/videos/`. Do not edit by hand: change the content, then run `npx vitest run -u` to regenerate. Items marked _(draft)_ are waiting for review.',
    '',
    `## Placement: ${placement.title}${draftTag(placement.draft)}`,
    '',
    placement.intro,
    '',
    `**${placement.skip.label}** on every screen. Confirmation: ${fill(placement.skip.confirm)} Buttons: "${placement.skip.confirmSkip}" and "${placement.skip.confirmKeep}".`,
    '',
    `Result screen when skipped: ${fill(placement.resultSkipped)}`,
    '',
    `Settings, retake: ${fill(placement.retake.updateGoal, { amount: '$X' })}`,
    '',
    `ChooseLoaf when an answer is unknown: ${placement.personalizePrompt}.`,
    '',
    `### Result screen: ${placement.result.title}`,
    '',
    `- ${placement.result.firstLoaf}`,
    `- ${fill(placement.result.goalMonths, { months: '3 months' })}`,
    `- ${fill(placement.result.goalDefault)}`,
    `- ${fill(placement.result.headStart, { saved: '$X', percent: 'N' })}`,
    `- ${placement.result.noHeadStart}`,
    `- Investment note: ${placement.result.investmentNote}`,
    `- Already built: ${placement.result.baked}`,
    `- Button: "${placement.result.continue}"`,
    '',
    `### Screen: ${placement.newLoaf.title}`,
    '',
    `- ${fill(placement.newLoaf.starterNote)}`,
    `- ${placement.newLoaf.needsExact}`,
    `- ${placement.newLoaf.biggerTarget}`,
    `- Labels: "${placement.newLoaf.goalLabel}", "${placement.newLoaf.customLabel}", "${placement.newLoaf.countSavings}", "${placement.newLoaf.exactSavingsLabel}", "${placement.newLoaf.exactEssentialsLabel}". Buttons: "${placement.newLoaf.start}", "${placement.newLoaf.confirmYes}", "${placement.newLoaf.confirmFix}".`,
    '',
    `### Screen: ${placement.newLoaf.builtTitle}`,
    '',
    `- ${placement.newLoaf.builtBody}`,
    `- Buttons: "${placement.newLoaf.reviewButton}", "${placement.newLoaf.chooseNext}", "${placement.newLoaf.reviewBack}". The review page shows the lesson summaries.`,
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

  out.push(
    `Option after it bakes: **${loaf.growOption.title}**. ${loaf.growOption.summary}`,
    '',
    `If essentials are unknown, it first asks: ${loaf.growOption.askEssentials}`,
    '',
    `Option for a fund that already covers 3 months or more (never recommended): **${loaf.growFurtherOption.title}**. ${loaf.growFurtherOption.summary}`,
    '',
    '## Lessons',
    '',
  );
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
      out.push(`- ${LETTERS[j]}. ${c.label} (\`${c.id}\`)${c.id === q.answer ? ' **(correct)**' : ''}`);
    });
    out.push('', `Explanation: ${q.explain}`, '');
    out.push(`Links to: lesson \`${q.lesson}\` at ${q.timestamp}s.`, '');
  });

  out.push('## Lesson and quiz screens', '');
  const flowGroups: [string, Record<string, string>][] = [
    ['Lessons list', loaf.flow.lessons],
    ['Lesson screen', loaf.flow.lesson],
    ['Quiz screens', loaf.flow.quiz],
  ];
  for (const [heading, copy] of flowGroups) {
    out.push(`### ${heading}`, '');
    for (const [key, text] of Object.entries(copy)) out.push(`- ${key}: ${text}`);
    out.push('');
  }

  out.push('## Saving setup, Home, celebration, shelf, and choosing the next loaf', '');
  for (const [heading, copy] of [
    ['Saving setup', loaf.flow.savingSetup],
    ['Home', loaf.flow.home],
    ['Celebration', loaf.flow.celebration],
    ['Bread shelf', loaf.flow.shelf],
    ['Choose your next loaf', loaf.flow.choose],
  ] as const) {
    out.push(`### ${heading}`, '');
    for (const [key, text] of flattenCopy(copy)) out.push(`- ${key}: ${text}`);
    out.push('');
  }

  const risk = getRisk();
  out.push(`## Risk quiz: ${risk.title}${draftTag(risk.draft)}`, '', risk.intro, '');
  out.push(`**${risk.skip.label}** on every screen. Confirmation: ${risk.skip.confirm} Buttons: "${risk.skip.confirmSkip}" and "${risk.skip.confirmKeep}".`, '');
  risk.questions.forEach((q, i) => {
    out.push(`### ${i + 1}. ${q.prompt}`, '');
    if (q.help) out.push(`Help text: ${q.help}`, '');
    for (const o of q.options) out.push(`- ${o.label} (\`${o.id}\`)`);
    out.push('');
  });
  out.push('### Risk quiz result', '');
  for (const [key, text] of flattenCopy(risk.result)) out.push(`- ${key}: ${text}`);
  out.push('');

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
