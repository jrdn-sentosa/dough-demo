import type { BreadId } from '../domain/breads';
import type { PayFrequency } from '../domain/habits';
import type { RiskQuestionId } from '../domain/risk';
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
  retake: { updateGoal: string; eyebrow: string; intro: string; done: string };
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
  celebration: CelebrationContent;
  shelf: ShelfContent;
  choose: ChooseContent;
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
  shelfLink: string;
  chooseNext: string;
  tips: { title: string; read: string; new: string; unlockedAt: string; unlocksAt: string; unlocksAtBaked: string };
  hysaCardDismiss: string;
}

/** Celebration screen. {amount} and {months} are filled in. */
export interface CelebrationContent {
  first: { title: string; body: string };
  rebuilt: { title: string; body: string };
  grown: { title: string; body: string };
  /** The grown copy when the student's essentials are unknown, so there is no months figure. */
  grownNoMonths: { title: string; body: string };
  mastered: string;
  tagline: string;
  chooseNext: string;
  shelf: string;
}

/** Bread shelf. {n} is a month count; {size} and {date} fill the baked label. */
export interface ShelfContent {
  title: string;
  intro: string;
  totalLabel: string;
  bakedHeading: string;
  comingSoonHeading: string;
  comingSoon: string;
  alreadyBuilt: string;
  monthOne: string;
  monthMany: string;
  bakedSub: string;
  back: string;
}

/** "Choose your next loaf": Keep saving or Start investing. */
export interface ChooseContent {
  title: string;
  intro: string;
  recommended: string;
  saveButton: string;
  saveButtonFurther: string;
  invest: { title: string; summary: string; button: string };
  personalize: string;
  debtUnknown: string;
  debt: { note: string; body: string; continueAnyway: string; back: string };
  essentials: { label: string; confirm: string; cancel: string; invalid: string };
  moreHeading: string;
  comingSoon: string;
  notNow: string;
}

export interface BuiltLoaf extends LoafBase {
  status: 'built';
  targetMonths: { default: number; choices: number[] };
  growOption: GrowOption;
  /** Offered for a fund that already covers 3 months or more: grow to 6 months. Never recommended. */
  growFurtherOption: GrowOption;
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
  /**
   * How many questions one attempt asks, drawn from `questions` (the bank). The quiz and the test-out each draw this
   * many, with at least one question from every lesson. The daily quiz uses the whole bank.
   */
  draw: number;
  questions: QuizQuestionContent[];
}

export interface RiskQuestionContent {
  id: RiskQuestionId;
  prompt: string;
  help: string | null;
  options: { id: string; label: string }[];
}

/** The risk quiz and its result. Educational wording only: no percentages, allocations or fund names. */
export interface RiskContent {
  draft: boolean;
  title: string;
  intro: string;
  progressLabel: string;
  /** {n} and {total}. */
  questionOf: string;
  next: string;
  back: string;
  seeResult: string;
  skip: { label: string; confirm: string; confirmSkip: string; confirmKeep: string };
  questions: RiskQuestionContent[];
  result: {
    title: string;
    educational: string;
    keepSavings: { title: string; body: string; grow: string };
    approach: Record<'steady' | 'growth', { title: string; body: string }>;
    /** {loaf} and {bread}. */
    loafLine: string;
    comingSoon: string;
    where: Record<'roth-ira' | 'investment-account' | 'unknown', { title: string; body: string }>;
    startSmall: string;
    knowledgeCheck: string;
    skippedNote: string;
    back: string;
    chooseAgain: string;
  };
}

/** Copy for Settings: changing the goal and the saving habit. `{token}` placeholders are filled at display time. */
export interface SettingsContent {
  draft: boolean;
  goal: Record<
    'title' | 'current' | 'intro' | 'monthsLegend' | 'month' | 'months' | 'noEssentials' | 'customLabel' | 'save' | 'invalid' | 'edited' | 'growing' | 'baked',
    string
  >;
  habit: Record<'title' | 'current' | 'weekly' | 'paycheck' | 'save' | 'restartNote' | 'saved' | 'savedRestart', string>;
  risk: Record<'title' | 'intro' | 'link', string>;
  /** "Send feedback" and the version line. `{token}` placeholders are filled at display time. */
  feedback: Record<
    | 'title'
    | 'intro'
    | 'label'
    | 'placeholder'
    | 'counter'
    | 'categoryLegend'
    | 'categoryBug'
    | 'categoryIdea'
    | 'categoryOther'
    | 'privacy'
    | 'send'
    | 'sending'
    | 'sent'
    | 'failed'
    | 'demoNote'
    | 'demoSend'
    | 'emailTo'
    | 'emailSubject'
    | 'emailVersion'
    | 'emailScreen'
    | 'emailKind'
    | 'version',
    string
  >;
  /** "Clear app data", a demo-mode tool in Settings. `askDemo` is for the demo user, `askAccount` for a signed-in account. */
  clearData: Record<'title' | 'intro' | 'button' | 'askDemo' | 'askAccount' | 'confirm' | 'cancel' | 'working' | 'failed', string>;
}

/** Dough points, the points history and the daily quiz. Never mentions a day without a point. */
export interface PointsContent {
  draft: boolean;
  home: Record<'label' | 'linkLabel', string>;
  history: Record<'title' | 'intro' | 'total' | 'totalOne' | 'empty' | 'earned' | 'showMore' | 'back' | 'demoNote', string> & {
    /** What earned a point, by kind. Tokens: `{date}`, `{lesson}`, `{loaf}`. */
    reasons: Record<'fund-day' | 'video' | 'mastery' | 'bake' | 'quiz', string>;
  };
  daily: Record<'title' | 'intro' | 'check' | 'right' | 'wrong' | 'done', string>;
}

/**
 * The Share button, its sheet and the lines on the share picture. Never has an amount token: the picture
 * says nothing about the student's money.
 */
export interface ShareContent {
  draft: boolean;
  button: Record<'label', string>;
  sheet: Record<
    | 'title'
    | 'intro'
    | 'sizeLegend'
    | 'story'
    | 'post'
    | 'preparing'
    | 'previewAlt'
    | 'shareImage'
    | 'copyText'
    | 'close'
    | 'downloaded'
    | 'copied'
    | 'copyFailed'
    | 'failed',
    string
  >;
  /** The lines drawn on the picture (and used in the copied text). */
  card: Record<'baked' | 'mastered' | 'tagline', string>;
}

/** Bread names and the copy for streaks, the unlock moment, the bread picker and the demo tools. */
export interface BreadsContent {
  draft: boolean;
  names: Record<BreadId, string>;
  streak: {
    label: string;
    valueNone: string;
    /** {count}. */
    valueWeek: string;
    valuePayPeriodOne: string;
    /** {count}. */
    valuePayPeriod: string;
    valueMonthOne: string;
    /** {count}. */
    valueMonth: string;
    /** {weeks}. */
    weeksPill: string;
    /** {bread} and {weeks}. */
    startNext: string;
    /** {bread} (the latest unlocked), {next} and {weeks}. */
    unlockedNext: string;
    allUnlocked: string;
    resetValue: string;
    /** {bread} and {weeks}. */
    resetBody: string;
    resetAllUnlocked: string;
  };
  unlock: {
    /** {bread}. */
    title: string;
    body: string;
    dismiss: string;
  };
  picker: {
    title: string;
    intro: string;
    defaultTag: string;
    unlockedTag: string;
    lockedOne: string;
    /** {count}. */
    locked: string;
    /** {bread}. */
    button: string;
    back: string;
    groupLabel: string;
  };
  demo: {
    heading: string;
    skipWeek: string;
    skipWeekWithoutSaving: string;
    resetDemo: string;
    resetDemoNote: string;
    startFresh: string;
    startFreshNote: string;
    confirm: string;
    cancel: string;
  };
}
