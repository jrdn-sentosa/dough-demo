import type { PayFrequency } from '../domain/habits';
import type { AccountType, LoafId, Stage } from '../domain/types';

export interface PlacementOption {
  id: string;
  label: string;
}

export type PlacementQuestionId =
  | 'essentials'
  | 'existing-savings'
  | 'accounts'
  | 'card-debt'
  | 'earned-income';

export interface PlacementQuestion {
  id: PlacementQuestionId;
  kind: 'single' | 'multi';
  prompt: string;
  help: string | null;
  options: PlacementOption[];
}

export interface PlacementContent {
  draft: boolean;
  title: string;
  intro: string;
  /** "Skip for now" on every placement screen, and its confirmation. `{goal}` is the starter goal. */
  skip: { label: string; confirm: string; confirmSkip: string; confirmKeep: string };
  /** Result screen after skipping. `{goal}` is the starter goal. */
  resultSkipped: string;
  /** Settings, "Retake the quiz". `{amount}` is the suggested goal. */
  retake: { updateGoal: string };
  /** ChooseLoaf when an unknown answer blocks a recommendation. Opens placement. */
  personalizePrompt: string;
  /**
   * "Here's where you'll start". Tokens: `{goal}`, `{months}` (e.g. "3 months"),
   * `{saved}` (existing savings), `{percent}`.
   */
  result: {
    title: string;
    firstLoaf: string;
    goalMonths: string;
    goalDefault: string;
    headStart: string;
    noHeadStart: string;
    investmentNote: string;
    baked: string;
    continue: string;
  };
  /** "Your new loaf" and the review page for a fund that starts baked. `{goal}` is the starter goal. */
  newLoaf: {
    title: string;
    goalLabel: string;
    starterNote: string;
    needsExact: string;
    exactEssentialsLabel: string;
    customLabel: string;
    countSavings: string;
    exactSavingsLabel: string;
    biggerTarget: string;
    start: string;
    confirmYes: string;
    confirmFix: string;
    builtTitle: string;
    builtBody: string;
    reviewButton: string;
    chooseNext: string;
    reviewTitle: string;
    reviewBack: string;
  };
  questions: PlacementQuestion[];
}

export interface Tip {
  stage: Exclude<Stage, 'mix'>;
  title: string;
  body: string;
}

interface LoafBase {
  id: LoafId;
  draft: boolean;
  title: string;
  bread: string;
  breadWhy: string;
  summary: string;
}

/** "Grow your cushion": a ChooseLoaf option that raises the target on the same loaf. */
export interface GrowOption {
  title: string;
  summary: string;
  targetMonths: number;
  /** Asked first when essentials are unknown, before the 3-month goal can be sized. */
  askEssentials: string;
}

/** Screen copy for the lessons list, lesson screen and quiz. Tokens: `{score}`, `{total}`, `{n}`, `{answer}`. */
export interface FlowContent {
  lessons: {
    title: string;
    intro: string;
    testOutButton: string;
    quizButton: string;
    recommended: string;
    known: string;
    answeredRight: string;
    watchAnyway: string;
    watched: string;
    mastered: string;
    reviewTitle: string;
    reviewIntro: string;
    allOptionalTitle: string;
    allOptionalBody: string;
    continueSaving: string;
  };
  lesson: {
    videoSoon: string;
    videoSoonNote: string;
    markWatched: string;
    watched: string;
    next: string;
    toQuiz: string;
    back: string;
    fromQuiz: string;
  };
  quiz: {
    testOutTitle: string;
    testOutIntro: string;
    check: string;
    next: string;
    seeScore: string;
    correct: string;
    notQuite: string;
    correctAnswer: string;
    rewatch: string;
    readSummary: string;
    questionOf: string;
    scoreTitle: string;
    score: string;
    reviewMissed: string;
    tryAgain: string;
    continueSaving: string;
    scoreNote: string;
    mastered: string;
    masteredBefore: string;
    masteryHint: string;
    testOutPassTitle: string;
    testOutPassBody: string;
    testOutFailBody: string;
    testOutLessons: string;
    testOutToLessons: string;
  };
  savingSetup: SavingSetupContent;
  home: HomeContent;
}

/** Saving setup and Home copy. Money, percents and stage names are tokens filled in by the screens. */
export interface SavingSetupContent {
  /** The "open a high-yield savings account" step, also shown on the Home reminder card. */
  hysa: {
    title: string;
    intro: string;
    /** The "what to look for" points from the where-to-keep lesson. */
    points: string[];
    demoNote: string;
    haveOne: string;
    later: string;
  };
  /** `{amount}`, `{percent}` and `{paycheck}` are filled in. */
  habit: {
    title: string;
    intro: string;
    weeklyTitle: string;
    weeklyBody: string;
    weeklyLabel: string;
    paycheckTitle: string;
    paycheckBody: string;
    paycheckLabel: string;
    frequencyLabel: string;
    frequencies: Record<PayFrequency, string>;
    paycheckAmountLabel: string;
    paycheckNote: string;
    accountNote: string;
    invalid: string;
    continue: string;
    skip: string;
  };
  automatic: { title: string; body: string; skippedNote: string; done: string };
}

export interface HomeContent {
  eyebrow: string;
  mastered: string;
  progressLabel: string;
  amountOf: string;
  keptIn: string;
  disclaimer: string;
  wholeFund: string;
  /** `{stage}` and `{detail}`. */
  stageLineFormat: string;
  percentOfGoal: string;
  percentOfNewGoal: string;
  rebuilding: string;
  stageLine: Record<Stage, string>;
  /** Names on the bar's dots. */
  stageNames: Record<Stage, string>;
  habitCard: {
    label: Record<PayFrequency, string>;
    value: string;
    notLogged: string;
    logged: string;
    lastAdded: string;
    neverAdded: string;
  };
  add: string;
  use: string;
  addSheet: { title: string; amountLabel: string; confirm: string; cancel: string; invalid: string };
  useSheet: { title: string; intro: string; available: string; amountLabel: string; confirm: string; cancel: string; invalid: string };
  stageUp: string;
  stageUpTip: string;
  stageDown: string;
  readTip: string;
  dismissNotice: string;
  tips: { title: string; read: string; new: string; unlockedAt: string; unlocksAt: string; unlocksAtBaked: string };
  hysaCardDismiss: string;
  /** Until the celebration screen is built (milestone 8). */
  completePlaceholder: { title: string; body: string; home: string };
}

export interface BuiltLoaf extends LoafBase {
  status: 'built';
  targetMonths: { default: number; choices: number[] };
  growOption: GrowOption;
  /** Lesson ids in the order they're taught. */
  lessons: string[];
  quiz: string;
  flow: FlowContent;
  tips: Tip[];
}

export interface ComingSoonLoaf extends LoafBase {
  status: 'coming-soon';
  note: string | null;
}

export type LoafDefinition = BuiltLoaf | ComingSoonLoaf;

export interface Lesson {
  id: string;
  loaf: LoafId;
  draft: boolean;
  title: string;
  /** Markdown summary shown below the video. */
  summary: string;
  durationSeconds: number;
  /** Public URL. The file may not exist yet: the player shows "Video coming soon". */
  videoUrl: string;
  captionsUrl: string;
  /** When the student has this account type, the lesson is optional. */
  optionalFor: AccountType | null;
}

/** One answer choice. The id is fixed in the content file, so saved answers don't depend on order or wording. */
export interface QuizChoice {
  id: string;
  label: string;
}

export interface QuizQuestionContent {
  id: string;
  question: string;
  choices: QuizChoice[];
  /** The id of the correct choice. */
  answer: string;
  explain: string;
  lesson: string;
  timestamp: number;
}

export interface QuizContent {
  draft: boolean;
  loaf: LoafId;
  questions: QuizQuestionContent[];
}
