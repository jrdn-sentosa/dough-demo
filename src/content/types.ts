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
}

export interface BuiltLoaf extends LoafBase {
  status: 'built';
  targetMonths: { default: number; choices: number[] };
  growOption: GrowOption;
  /** Lesson ids in the order they're taught. */
  lessons: string[];
  quiz: string;
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

export interface QuizQuestionContent {
  id: string;
  question: string;
  choices: string[];
  answer: number;
  explain: string;
  lesson: string;
  timestamp: number;
}

export interface QuizContent {
  draft: boolean;
  loaf: LoafId;
  questions: QuizQuestionContent[];
}
