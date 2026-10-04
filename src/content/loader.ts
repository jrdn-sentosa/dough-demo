import { BREAD_IDS } from '../domain/breads';
import { parseFrontmatter } from '../domain/frontmatter';
import { PAY_FREQUENCIES } from '../domain/habits';
import { POINT_KINDS } from '../domain/points';
import { RISK_QUESTION_IDS } from '../domain/risk';
import { STAGES } from '../domain/stages';
import type { AccountType, LoafId, Stage } from '../domain/types';
import { ContentError, arr, bool, num, obj, oneOf, optStr, str } from './guards';
import type {
  BreadsContent,
  PreviewContent,
  SettingsContent,
  CelebrationContent,
  ChooseContent,
  FlowContent,
  RiskContent,
  ShelfContent,
  HomeContent,
  SavingSetupContent,
  Lesson,
  LoafDefinition,
  PlacementContent,
  PlacementQuestion,
  PointsContent,
  ShareContent,
  QuizChoice,
  QuizContent,
  Tip,
} from './types';

export const LOAF_IDS: readonly LoafId[] = [
  'emergency-fund',
  'index-funds',
  'bonds',
  'roth-ira',
  'debt-payoff',
];
export const ACCOUNT_TYPES: readonly AccountType[] = [
  'checking',
  'regular-savings',
  'high-yield-savings',
  'retirement',
  'investment',
  'none',
  'not-sure',
];
export const PLACEMENT_QUESTION_IDS = [
  'essentials',
  'existing-savings',
  'accounts',
  'card-debt',
  'earned-income',
] as const;
const TIP_STAGES: readonly Exclude<Stage, 'mix'>[] = ['shape', 'proof', 'bake', 'baked'];

const placementFiles = import.meta.glob<unknown>('../../content/placement.json', {
  eager: true,
  import: 'default',
});
const loafFiles = import.meta.glob<unknown>('../../content/loaves/*.json', {
  eager: true,
  import: 'default',
});
const lessonFiles = import.meta.glob<string>('../../content/lessons/*/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const riskFiles = import.meta.glob<unknown>('../../content/risk.json', {
  eager: true,
  import: 'default',
});
const breadFiles = import.meta.glob<unknown>('../../content/breads.json', {
  eager: true,
  import: 'default',
});
const settingsFiles = import.meta.glob<unknown>('../../content/settings.json', {
  eager: true,
  import: 'default',
});
const previewFiles = import.meta.glob<unknown>('../../content/preview.json', {
  eager: true,
  import: 'default',
});
const pointsFiles = import.meta.glob<unknown>('../../content/points.json', {
  eager: true,
  import: 'default',
});
const shareFiles = import.meta.glob<unknown>('../../content/share.json', {
  eager: true,
  import: 'default',
});
const quizFiles = import.meta.glob<unknown>('../../content/quizzes/*.json', {
  eager: true,
  import: 'default',
});

function parsePlacement(raw: unknown): PlacementContent {
  const where = 'content/placement.json';
  const o = obj(raw, where);
  const questions = arr(o, 'questions', where).map((q, i): PlacementQuestion => {
    const w = `${where} question ${i + 1}`;
    const qo = obj(q, w);
    return {
      id: oneOf(qo, 'id', PLACEMENT_QUESTION_IDS, w),
      kind: oneOf(qo, 'kind', ['single', 'multi'], w),
      prompt: str(qo, 'prompt', w),
      help: optStr(qo, 'help', w),
      options: arr(qo, 'options', w).map((opt, j) => {
        const oo = obj(opt, `${w} option ${j + 1}`);
        return { id: str(oo, 'id', w), label: str(oo, 'label', w) };
      }),
    };
  });
  const skip = obj(o.skip, `${where} skip`);
  const retake = obj(o.retake, `${where} retake`);
  const rw = `${where} result`;
  const result = obj(o.result, rw);
  const nw = `${where} newLoaf`;
  const newLoaf = obj(o.newLoaf, nw);
  return {
    draft: bool(o, 'draft', where),
    title: str(o, 'title', where),
    intro: str(o, 'intro', where),
    skip: {
      label: str(skip, 'label', `${where} skip`),
      confirm: str(skip, 'confirm', `${where} skip`),
      confirmSkip: str(skip, 'confirmSkip', `${where} skip`),
      confirmKeep: str(skip, 'confirmKeep', `${where} skip`),
    },
    resultSkipped: str(o, 'resultSkipped', where),
    retake: {
      updateGoal: str(retake, 'updateGoal', `${where} retake`),
      eyebrow: str(retake, 'eyebrow', `${where} retake`),
      intro: str(retake, 'intro', `${where} retake`),
      done: str(retake, 'done', `${where} retake`),
    },
    personalizePrompt: str(o, 'personalizePrompt', where),
    result: {
      title: str(result, 'title', rw),
      firstLoaf: str(result, 'firstLoaf', rw),
      goalMonths: str(result, 'goalMonths', rw),
      goalDefault: str(result, 'goalDefault', rw),
      headStart: str(result, 'headStart', rw),
      noHeadStart: str(result, 'noHeadStart', rw),
      investmentNote: str(result, 'investmentNote', rw),
      baked: str(result, 'baked', rw),
      continue: str(result, 'continue', rw),
    },
    newLoaf: {
      title: str(newLoaf, 'title', nw),
      goalLabel: str(newLoaf, 'goalLabel', nw),
      starterNote: str(newLoaf, 'starterNote', nw),
      needsExact: str(newLoaf, 'needsExact', nw),
      exactEssentialsLabel: str(newLoaf, 'exactEssentialsLabel', nw),
      customLabel: str(newLoaf, 'customLabel', nw),
      countSavings: str(newLoaf, 'countSavings', nw),
      exactSavingsLabel: str(newLoaf, 'exactSavingsLabel', nw),
      biggerTarget: str(newLoaf, 'biggerTarget', nw),
      start: str(newLoaf, 'start', nw),
      confirmYes: str(newLoaf, 'confirmYes', nw),
      confirmFix: str(newLoaf, 'confirmFix', nw),
      builtTitle: str(newLoaf, 'builtTitle', nw),
      builtBody: str(newLoaf, 'builtBody', nw),
      reviewButton: str(newLoaf, 'reviewButton', nw),
      chooseNext: str(newLoaf, 'chooseNext', nw),
      reviewTitle: str(newLoaf, 'reviewTitle', nw),
      reviewBack: str(newLoaf, 'reviewBack', nw),
    },
    questions,
  };
}

/** Reads every key in `keys` as a non-empty string, so a missing line of screen copy throws at load. */
function strings<K extends string>(o: Record<string, unknown>, keys: readonly K[], where: string): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of keys) out[key] = str(o, key, where);
  return out;
}

/** Reads a record that must have a non-empty string for every key in `keys`. */
function record<K extends string>(raw: unknown, keys: readonly K[], where: string): Record<K, string> {
  return strings(obj(raw, where), keys, where);
}

function stringList(o: Record<string, unknown>, key: string, where: string): string[] {
  return arr(o, key, where).map((v) => {
    if (typeof v !== 'string' || v.trim() === '') throw new ContentError(where, `"${key}" must be a list of non-empty strings`);
    return v;
  });
}

function parseSavingSetup(raw: unknown, w: string): SavingSetupContent {
  const o = obj(raw, w);
  const hysa = obj(o.hysa, `${w} hysa`);
  const habit = obj(o.habit, `${w} habit`);
  return {
    hysa: {
      ...strings(hysa, ['title', 'intro', 'demoNote', 'haveOne', 'later'] as const, `${w} hysa`),
      points: stringList(hysa, 'points', `${w} hysa`),
    },
    habit: {
      ...strings(
        habit,
        ['title', 'intro', 'weeklyTitle', 'weeklyBody', 'weeklyLabel', 'paycheckTitle', 'paycheckBody', 'paycheckLabel', 'frequencyLabel', 'paycheckAmountLabel', 'paycheckNote', 'accountNote', 'invalid', 'continue', 'skip'] as const,
        `${w} habit`,
      ),
      frequencies: record(habit.frequencies, PAY_FREQUENCIES, `${w} habit frequencies`),
    },
    automatic: record(o.automatic, ['title', 'body', 'skippedNote', 'done'] as const, `${w} automatic`),
  };
}

function parseHome(raw: unknown, w: string): HomeContent {
  const o = obj(raw, w);
  const card = obj(o.habitCard, `${w} habitCard`);
  return {
    ...strings(
      o,
      ['eyebrow', 'mastered', 'progressLabel', 'amountOf', 'keptIn', 'disclaimer', 'wholeFund', 'stageLineFormat', 'percentOfGoal', 'percentOfNewGoal', 'rebuilding', 'add', 'use', 'stageUp', 'stageUpTip', 'stageDown', 'readTip', 'dismissNotice', 'shelfLink', 'chooseNext', 'hysaCardDismiss'] as const,
      w,
    ),
    stageLine: record(o.stageLine, STAGES, `${w} stageLine`),
    stageNames: record(o.stageNames, STAGES, `${w} stageNames`),
    habitCard: {
      ...strings(card, ['value', 'notLogged', 'logged', 'lastAdded', 'neverAdded'] as const, `${w} habitCard`),
      label: record(card.label, PAY_FREQUENCIES, `${w} habitCard label`),
    },
    addSheet: record(o.addSheet, ['title', 'amountLabel', 'confirm', 'cancel', 'invalid'] as const, `${w} addSheet`),
    useSheet: record(o.useSheet, ['title', 'intro', 'available', 'amountLabel', 'confirm', 'cancel', 'invalid'] as const, `${w} useSheet`),
    tips: record(o.tips, ['title', 'read', 'new', 'unlockedAt', 'unlocksAt', 'unlocksAtBaked'] as const, `${w} tips`),
  };
}

function parseCelebration(raw: unknown, w: string): CelebrationContent {
  const o = obj(raw, w);
  const pair = (key: string) => record(o[key], ['title', 'body'] as const, `${w} ${key}`);
  return {
    first: pair('first'),
    rebuilt: pair('rebuilt'),
    grown: pair('grown'),
    grownNoMonths: pair('grownNoMonths'),
    ...strings(o, ['mastered', 'tagline', 'chooseNext', 'shelf'] as const, w),
  };
}

function parseShelf(raw: unknown, w: string): ShelfContent {
  return record(
    raw,
    ['title', 'intro', 'totalLabel', 'bakedHeading', 'comingSoonHeading', 'comingSoon', 'alreadyBuilt', 'monthOne', 'monthMany', 'bakedSub', 'back'] as const,
    w,
  );
}

function parseChoose(raw: unknown, w: string): ChooseContent {
  const o = obj(raw, w);
  return {
    ...strings(o, ['title', 'intro', 'recommended', 'saveButton', 'saveButtonFurther', 'personalize', 'debtUnknown', 'moreHeading', 'comingSoon', 'notNow'] as const, w),
    invest: record(o.invest, ['title', 'summary', 'button'] as const, `${w} invest`),
    debt: record(o.debt, ['note', 'body', 'continueAnyway', 'back'] as const, `${w} debt`),
    essentials: record(o.essentials, ['label', 'confirm', 'cancel', 'invalid'] as const, `${w} essentials`),
  };
}

function parseFlow(raw: unknown, file: string): FlowContent {
  const w = `${file} flow`;
  const o = obj(raw, w);
  return {
    lessons: strings(
      obj(o.lessons, `${w} lessons`),
      ['title', 'intro', 'testOutButton', 'quizButton', 'recommended', 'known', 'answeredRight', 'watchAnyway', 'watched', 'mastered', 'reviewTitle', 'reviewIntro', 'allOptionalTitle', 'allOptionalBody', 'continueSaving'] as const,
      `${w} lessons`,
    ),
    lesson: strings(
      obj(o.lesson, `${w} lesson`),
      ['videoSoon', 'videoSoonNote', 'markWatched', 'watched', 'next', 'toQuiz', 'back', 'fromQuiz'] as const,
      `${w} lesson`,
    ),
    quiz: strings(
      obj(o.quiz, `${w} quiz`),
      ['testOutTitle', 'testOutIntro', 'check', 'next', 'seeScore', 'correct', 'notQuite', 'correctAnswer', 'rewatch', 'readSummary', 'questionOf', 'scoreTitle', 'score', 'reviewMissed', 'tryAgain', 'continueSaving', 'scoreNote', 'mastered', 'masteredBefore', 'masteryHint', 'testOutPassTitle', 'testOutPassBody', 'testOutFailBody', 'testOutLessons', 'testOutToLessons'] as const,
      `${w} quiz`,
    ),
    savingSetup: parseSavingSetup(o.savingSetup, `${w} savingSetup`),
    home: parseHome(o.home, `${w} home`),
    celebration: parseCelebration(o.celebration, `${w} celebration`),
    shelf: parseShelf(o.shelf, `${w} shelf`),
    choose: parseChoose(o.choose, `${w} choose`),
  };
}

export function parseLoaf(raw: unknown, file: string): LoafDefinition {
  const o = obj(raw, file);
  const id = oneOf(o, 'id', LOAF_IDS, file);
  const base = {
    id,
    draft: bool(o, 'draft', file),
    title: str(o, 'title', file),
    bread: str(o, 'bread', file),
    breadWhy: str(o, 'breadWhy', file),
    summary: str(o, 'summary', file),
  };
  const status = oneOf(o, 'status', ['built', 'coming-soon'], file);
  if (status === 'coming-soon') {
    return { ...base, status, note: optStr(o, 'note', file) };
  }
  const months = obj(o.targetMonths, `${file} targetMonths`);
  const grow = obj(o.growOption, `${file} growOption`);
  const further = obj(o.growFurtherOption, `${file} growFurtherOption`);
  const tips = arr(o, 'tips', file).map((t, i): Tip => {
    const w = `${file} tip ${i + 1}`;
    const to = obj(t, w);
    return {
      stage: oneOf(to, 'stage', TIP_STAGES, w),
      title: str(to, 'title', w),
      body: str(to, 'body', w),
    };
  });
  return {
    ...base,
    status,
    targetMonths: {
      default: num(months, 'default', file),
      choices: arr(months, 'choices', file).map((c) => {
        if (typeof c !== 'number') throw new ContentError(file, 'targetMonths choices must be numbers');
        return c;
      }),
    },
    growOption: {
      title: str(grow, 'title', `${file} growOption`),
      summary: str(grow, 'summary', `${file} growOption`),
      targetMonths: num(grow, 'targetMonths', `${file} growOption`),
      askEssentials: str(grow, 'askEssentials', `${file} growOption`),
    },
    growFurtherOption: {
      title: str(further, 'title', `${file} growFurtherOption`),
      summary: str(further, 'summary', `${file} growFurtherOption`),
      targetMonths: num(further, 'targetMonths', `${file} growFurtherOption`),
      askEssentials: str(further, 'askEssentials', `${file} growFurtherOption`),
    },
    lessons: arr(o, 'lessons', file).map((l) => {
      if (typeof l !== 'string') throw new ContentError(file, 'lessons must be lesson ids');
      return l;
    }),
    quiz: str(o, 'quiz', file),
    flow: parseFlow(o.flow, file),
    tips,
  };
}

export function parseRisk(raw: unknown, where = 'content/risk.json'): RiskContent {
  const o = obj(raw, where);
  const rw = `${where} result`;
  const result = obj(o.result, rw);
  const pair = (value: unknown, label: string) => record(value, ['title', 'body'] as const, `${rw} ${label}`);
  const approach = obj(result.approach, `${rw} approach`);
  const whereOptions = obj(result.where, `${rw} where`);
  const questions = arr(o, 'questions', where).map((q, i): RiskContent['questions'][number] => {
    const w = `${where} question ${i + 1}`;
    const qo = obj(q, w);
    return {
      id: oneOf(qo, 'id', RISK_QUESTION_IDS, w),
      prompt: str(qo, 'prompt', w),
      help: optStr(qo, 'help', w),
      options: arr(qo, 'options', w).map((opt, j) => {
        const oo = obj(opt, `${w} option ${j + 1}`);
        return { id: str(oo, 'id', w), label: str(oo, 'label', w) };
      }),
    };
  });
  if (questions.map((q) => q.id).join() !== RISK_QUESTION_IDS.join()) {
    throw new ContentError(where, `questions must be, in order: ${RISK_QUESTION_IDS.join(', ')}`);
  }
  return {
    draft: bool(o, 'draft', where),
    ...strings(o, ['title', 'intro', 'progressLabel', 'questionOf', 'next', 'back', 'seeResult'] as const, where),
    skip: record(o.skip, ['label', 'confirm', 'confirmSkip', 'confirmKeep'] as const, `${where} skip`),
    questions,
    result: {
      ...strings(result, ['title', 'educational', 'loafLine', 'comingSoon', 'startSmall', 'knowledgeCheck', 'skippedNote', 'back', 'chooseAgain'] as const, rw),
      keepSavings: record(result.keepSavings, ['title', 'body', 'grow'] as const, `${rw} keepSavings`),
      approach: { steady: pair(approach.steady, 'approach steady'), growth: pair(approach.growth, 'approach growth') },
      where: {
        'roth-ira': pair(whereOptions['roth-ira'], 'where roth-ira'),
        'investment-account': pair(whereOptions['investment-account'], 'where investment-account'),
        unknown: pair(whereOptions.unknown, 'where unknown'),
      },
    },
  };
}

export function parseBreads(raw: unknown, where = 'content/breads.json'): BreadsContent {
  const o = obj(raw, where);
  const names = obj(o.names, `${where} names`);
  const demo = obj(o.demo, `${where} demo`);
  return {
    draft: bool(o, 'draft', where),
    names: Object.fromEntries(BREAD_IDS.map((id) => [id, str(names, id, `${where} names`)])) as BreadsContent['names'],
    streak: record(
      o.streak,
      ['label', 'valueNone', 'valueWeek', 'valuePayPeriodOne', 'valuePayPeriod', 'valueMonthOne', 'valueMonth', 'weeksPill', 'startNext', 'unlockedNext', 'allUnlocked', 'resetValue', 'resetBody', 'resetAllUnlocked'] as const,
      `${where} streak`,
    ),
    unlock: record(o.unlock, ['title', 'body', 'dismiss'] as const, `${where} unlock`),
    picker: record(o.picker, ['title', 'intro', 'defaultTag', 'unlockedTag', 'lockedOne', 'locked', 'button', 'back', 'groupLabel'] as const, `${where} picker`),
    demo: strings(demo, ['heading', 'skipWeek', 'skipWeekWithoutSaving', 'resetDemo', 'resetDemoNote', 'startFresh', 'startFreshNote', 'confirm', 'cancel'] as const, `${where} demo`),
  };
}

export function parseSettings(raw: unknown, where = 'content/settings.json'): SettingsContent {
  const o = obj(raw, where);
  return {
    draft: bool(o, 'draft', where),
    goal: record(o.goal, ['title', 'current', 'intro', 'monthsLegend', 'month', 'months', 'noEssentials', 'customLabel', 'save', 'invalid', 'edited', 'growing', 'baked'] as const, `${where} goal`),
    habit: record(o.habit, ['title', 'current', 'weekly', 'paycheck', 'save', 'restartNote', 'saved', 'savedRestart'] as const, `${where} habit`),
    risk: record(o.risk, ['title', 'intro', 'link'] as const, `${where} risk`),
    feedback: record(
      o.feedback,
      [
        'title',
        'intro',
        'label',
        'placeholder',
        'counter',
        'categoryLegend',
        'categoryBug',
        'categoryIdea',
        'categoryOther',
        'privacy',
        'send',
        'sending',
        'sent',
        'failed',
        'demoNote',
        'demoSend',
        'emailTo',
        'emailSubject',
        'emailVersion',
        'emailScreen',
        'emailKind',
        'version',
      ] as const,
      `${where} feedback`,
    ),
    clearData: record(
      o.clearData,
      ['title', 'intro', 'button', 'askDemo', 'askAccount', 'confirm', 'cancel', 'working', 'failed'] as const,
      `${where} clearData`,
    ),
  };
}

export function parsePoints(raw: unknown, where = 'content/points.json'): PointsContent {
  const o = obj(raw, where);
  const history = obj(o.history, `${where} history`);
  return {
    draft: bool(o, 'draft', where),
    home: record(o.home, ['label', 'linkLabel'] as const, `${where} home`),
    history: {
      ...record(history, ['title', 'intro', 'total', 'totalOne', 'empty', 'earned', 'showMore', 'back', 'demoNote'] as const, `${where} history`),
      reasons: record(history.reasons, POINT_KINDS, `${where} history reasons`),
    },
    daily: record(
      o.daily,
      [
        'title',
        'popupBody',
        'start',
        'notNow',
        'hideToday',
        'dontShowAgain',
        'dotLabel',
        'takeQuiz',
        'progress',
        'check',
        'next',
        'finish',
        'right',
        'wrong',
        'resultTitle',
        'resultScore',
        'resultFinished',
        'resultBonus',
        'resultNext',
        'backHome',
        'alreadyDone',
        'unavailable',
        'settingsTitle',
        'settingsIntro',
        'settingsLabel',
      ] as const,
      `${where} daily`,
    ),
  };
}

export function parsePreview(raw: unknown, where = 'content/preview.json'): PreviewContent {
  const o = obj(raw, where);
  const about = obj(o.about, `${where} about`);
  const notHere = stringList(about, 'notHere', `${where} about`);
  if (notHere.length === 0) throw new ContentError(`${where} about`, '"notHere" must list at least one thing');
  return {
    draft: bool(o, 'draft', where),
    label: str(o, 'label', where),
    about: { ...strings(about, ['title', 'settingsTitle', 'body', 'notHereTitle'] as const, `${where} about`), notHere },
    notice: record(o.notice, ['gotIt', 'sendFeedback', 'feedbackSubject'] as const, `${where} notice`),
    privacy: record(o.privacy, ['title', 'body'] as const, `${where} privacy`),
  };
}

export function parseShare(raw: unknown, where = 'content/share.json'): ShareContent {
  const o = obj(raw, where);
  return {
    draft: bool(o, 'draft', where),
    button: record(o.button, ['label'] as const, `${where} button`),
    sheet: record(
      o.sheet,
      ['title', 'intro', 'sizeLegend', 'story', 'post', 'preparing', 'previewAlt', 'shareImage', 'copyText', 'close', 'downloaded', 'copied', 'copyFailed', 'failed'] as const,
      `${where} sheet`,
    ),
    card: record(o.card, ['baked', 'mastered', 'tagline'] as const, `${where} card`),
  };
}

export function parseLesson(source: string, file: string): Lesson {
  const match = /content\/lessons\/([^/]+)\/[^/]+\.md$/.exec(file);
  if (!match) throw new ContentError(file, 'lessons must live in content/lessons/<loaf>/');
  const loaf = match[1] as LoafId;
  if (!LOAF_IDS.includes(loaf)) throw new ContentError(file, `unknown loaf folder "${loaf}"`);

  const { data, body } = parseFrontmatter(source);
  const fm = data as Record<string, unknown>;
  const optionalFor = optStr(fm, 'optionalFor', file);
  if (optionalFor !== null && !(ACCOUNT_TYPES as readonly string[]).includes(optionalFor)) {
    throw new ContentError(file, `"optionalFor" must be an account type, got "${optionalFor}"`);
  }
  if (body.trim() === '') throw new ContentError(file, 'lesson summary is empty');
  return {
    id: str(fm, 'id', file),
    loaf,
    draft: bool(fm, 'draft', file),
    title: str(fm, 'title', file),
    summary: body.trim(),
    durationSeconds: num(fm, 'durationSeconds', file),
    videoUrl: `/videos/${loaf}/${str(fm, 'video', file)}`,
    captionsUrl: `/videos/${loaf}/${str(fm, 'captions', file)}`,
    optionalFor: optionalFor as AccountType | null,
  };
}

export function parseQuiz(raw: unknown, file: string): QuizContent {
  const o = obj(raw, file);
  const questions = arr(o, 'questions', file);
  const draw = num(o, 'draw', file);
  if (!Number.isInteger(draw) || draw < 1 || draw > questions.length) {
    throw new ContentError(file, `"draw" must be a whole number from 1 to the number of questions (${questions.length})`);
  }
  return {
    draft: bool(o, 'draft', file),
    loaf: oneOf(o, 'loaf', LOAF_IDS, file),
    draw,
    questions: questions.map((q, i) => {
      const w = `${file} question ${i + 1}`;
      const qo = obj(q, w);
      const choices = arr(qo, 'choices', w).map((c, j): QuizChoice => {
        const cw = `${w} choice ${j + 1}`;
        const co = obj(c, cw);
        return { id: str(co, 'id', cw), label: str(co, 'label', cw) };
      });
      const ids = choices.map((c) => c.id);
      if (new Set(ids).size !== ids.length) throw new ContentError(w, 'choice ids must be unique within a question');
      const answer = str(qo, 'answer', w);
      if (!ids.includes(answer)) throw new ContentError(w, `"answer" must be the id of one of the choices (${ids.join(', ')})`);
      return {
        id: str(qo, 'id', w),
        question: str(qo, 'question', w),
        choices,
        answer,
        explain: str(qo, 'explain', w),
        lesson: str(qo, 'lesson', w),
        timestamp: num(qo, 'timestamp', w),
      };
    }),
  };
}

interface Content {
  placement: PlacementContent;
  risk: RiskContent;
  breads: BreadsContent;
  settings: SettingsContent;
  preview: PreviewContent;
  points: PointsContent;
  share: ShareContent;
  loaves: LoafDefinition[];
  lessons: Lesson[];
  quizzes: QuizContent[];
}

let cache: Content | null = null;

function content(): Content {
  if (cache) return cache;
  const [placementRaw] = Object.values(placementFiles);
  if (placementRaw === undefined) throw new ContentError('content/', 'placement.json is missing');

  const [riskRaw] = Object.values(riskFiles);
  if (riskRaw === undefined) throw new ContentError('content/', 'risk.json is missing');

  const [breadsRaw] = Object.values(breadFiles);
  if (breadsRaw === undefined) throw new ContentError('content/', 'breads.json is missing');

  const [settingsRaw] = Object.values(settingsFiles);
  if (settingsRaw === undefined) throw new ContentError('content/', 'settings.json is missing');

  const [previewRaw] = Object.values(previewFiles);
  if (previewRaw === undefined) throw new ContentError('content/', 'preview.json is missing');

  const [pointsRaw] = Object.values(pointsFiles);
  if (pointsRaw === undefined) throw new ContentError('content/', 'points.json is missing');

  const [shareRaw] = Object.values(shareFiles);
  if (shareRaw === undefined) throw new ContentError('content/', 'share.json is missing');

  const loaves = Object.entries(loafFiles).map(([file, raw]) => parseLoaf(raw, file));
  const ids = loaves.map((l) => l.id);
  if (new Set(ids).size !== ids.length) throw new ContentError('content/loaves', 'duplicate loaf id');

  cache = {
    placement: parsePlacement(placementRaw),
    risk: parseRisk(riskRaw),
    breads: parseBreads(breadsRaw),
    settings: parseSettings(settingsRaw),
    preview: parsePreview(previewRaw),
    points: parsePoints(pointsRaw),
    share: parseShare(shareRaw),
    loaves,
    lessons: Object.entries(lessonFiles).map(([file, src]) => parseLesson(src, file)),
    quizzes: Object.entries(quizFiles).map(([file, raw]) => parseQuiz(raw, file)),
  };
  return cache;
}

export function getRisk(): RiskContent {
  return content().risk;
}

export function getSettings(): SettingsContent {
  return content().settings;
}

export function getPreview(): PreviewContent {
  return content().preview;
}

export function getPoints(): PointsContent {
  return content().points;
}

export function getShare(): ShareContent {
  return content().share;
}

export function getBreads(): BreadsContent {
  return content().breads;
}

export function getPlacement(): PlacementContent {
  return content().placement;
}

/** All five loaves in a stable order: the emergency fund first. */
export function getLoaves(): LoafDefinition[] {
  const all = content().loaves;
  return LOAF_IDS.flatMap((id) => all.filter((l) => l.id === id));
}

export function getLoaf(id: LoafId): LoafDefinition {
  const loaf = content().loaves.find((l) => l.id === id);
  if (!loaf) throw new ContentError('content/loaves', `no definition for loaf "${id}"`);
  return loaf;
}

export function getComingSoonLoaves(): LoafDefinition[] {
  return getLoaves().filter((l) => l.status === 'coming-soon');
}

/** Lessons for a built loaf, in teaching order. */
export function getLessons(loafId: LoafId): Lesson[] {
  const loaf = getLoaf(loafId);
  if (loaf.status !== 'built') return [];
  return loaf.lessons.map((id) => getLesson(loafId, id));
}

export function getLesson(loafId: LoafId, id: string): Lesson {
  const lesson = content().lessons.find((l) => l.loaf === loafId && l.id === id);
  if (!lesson) throw new ContentError('content/lessons', `no lesson "${id}" for loaf "${loafId}"`);
  return lesson;
}

export function getQuiz(loafId: LoafId): QuizContent {
  const quiz = content().quizzes.find((q) => q.loaf === loafId);
  if (!quiz) throw new ContentError('content/quizzes', `no quiz for loaf "${loafId}"`);
  return quiz;
}
