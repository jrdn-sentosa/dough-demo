import { parseFrontmatter } from '../domain/frontmatter';
import type { AccountType, LoafId, Stage } from '../domain/types';
import { ContentError, arr, bool, num, obj, oneOf, optStr, str } from './guards';
import type {
  Lesson,
  LoafDefinition,
  PlacementContent,
  PlacementQuestion,
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
  return {
    draft: bool(o, 'draft', where),
    title: str(o, 'title', where),
    intro: str(o, 'intro', where),
    questions,
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
    },
    lessons: arr(o, 'lessons', file).map((l) => {
      if (typeof l !== 'string') throw new ContentError(file, 'lessons must be lesson ids');
      return l;
    }),
    quiz: str(o, 'quiz', file),
    tips,
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
  return {
    draft: bool(o, 'draft', file),
    loaf: oneOf(o, 'loaf', LOAF_IDS, file),
    questions: arr(o, 'questions', file).map((q, i) => {
      const w = `${file} question ${i + 1}`;
      const qo = obj(q, w);
      const choices = arr(qo, 'choices', w).map((c) => {
        if (typeof c !== 'string' || c.trim() === '') throw new ContentError(w, 'choices must be text');
        return c;
      });
      const answer = num(qo, 'answer', w);
      if (!Number.isInteger(answer) || answer < 0 || answer >= choices.length) {
        throw new ContentError(w, '"answer" must be the index of one of the choices');
      }
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
  loaves: LoafDefinition[];
  lessons: Lesson[];
  quizzes: QuizContent[];
}

let cache: Content | null = null;

function content(): Content {
  if (cache) return cache;
  const [placementRaw] = Object.values(placementFiles);
  if (placementRaw === undefined) throw new ContentError('content/', 'placement.json is missing');

  const loaves = Object.entries(loafFiles).map(([file, raw]) => parseLoaf(raw, file));
  const ids = loaves.map((l) => l.id);
  if (new Set(ids).size !== ids.length) throw new ContentError('content/loaves', 'duplicate loaf id');

  cache = {
    placement: parsePlacement(placementRaw),
    loaves,
    lessons: Object.entries(lessonFiles).map(([file, src]) => parseLesson(src, file)),
    quizzes: Object.entries(quizFiles).map(([file, raw]) => parseQuiz(raw, file)),
  };
  return cache;
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
