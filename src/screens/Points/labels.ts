import { getLessons, getLoaf, getLoaves } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import type { PointsContent } from '../../content/types';
import { dayToDate } from '../../domain/days';
import type { PointEvent } from '../../domain/points';
import type { LoafId } from '../../domain/types';

const shortDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function lessonTitle(lessonId: string): string {
  for (const loaf of getLoaves()) {
    const lesson = getLessons(loaf.id).find((l) => l.id === lessonId);
    if (lesson) return lesson.title;
  }
  return lessonId;
}

/** Words for what earned a point. They come from content, so the ledger never stores wording. */
export function reasonLabel(event: PointEvent, copy: PointsContent['history']): string {
  const text = copy.reasons[event.kind];
  switch (event.kind) {
    case 'fund-day':
      return fillTemplate(text, { date: shortDate(dayToDate(event.ref)) });
    case 'video':
      return fillTemplate(text, { lesson: lessonTitle(event.ref) });
    case 'mastery':
    case 'bake':
      return fillTemplate(text, { loaf: getLoaf(event.ref as LoafId).title });
    case 'quiz':
      return text;
  }
}

/** When it was earned, in the student's local time. */
export function earnedOn(event: PointEvent): string {
  return shortDate(new Date(event.at));
}
