import type { LoafId, Stage } from '../domain/types';

// Stage illustrations: design/loaves/<loaf>/<stage>.svg. Bundled as URLs, so they work offline once cached.
const stageUrls = import.meta.glob<string>('../../design/loaves/*/*.svg', { eager: true, query: '?url', import: 'default' });

export function loafArtUrl(loafId: LoafId, stage: Stage): string {
  return stageUrls[`../../design/loaves/${loafId}/${stage}.svg`] ?? '';
}

// Dashed "Coming soon" outlines: design/loaves/outlines/<name>.svg.
const outlineUrls = import.meta.glob<string>('../../design/loaves/outlines/*.svg', { eager: true, query: '?url', import: 'default' });

export type OutlineName = 'braided' | 'rye' | 'sourdough' | 'flatbread';

/** The outline that stands for a loaf that isn't built yet. Null for the emergency fund, which has real art. */
export function outlineFor(loafId: LoafId): OutlineName | null {
  switch (loafId) {
    case 'index-funds':
      return 'braided';
    case 'bonds':
      return 'rye';
    case 'roth-ira':
      return 'sourdough';
    case 'debt-payoff':
      return 'flatbread';
    default:
      return null;
  }
}

export function outlineUrl(name: OutlineName): string {
  return outlineUrls[`../../design/loaves/outlines/${name}.svg`] ?? '';
}
