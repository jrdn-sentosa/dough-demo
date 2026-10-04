import { DEFAULT_BREAD } from '../domain/breads';
import type { BreadId } from '../domain/breads';
import type { LoafId, Stage } from '../domain/types';

// Stage illustrations: design/loaves/<bread>/<stage>.svg. Bundled as URLs, so they work offline once cached.
const stageUrls = import.meta.glob<string>('../../design/loaves/*/*.svg', { eager: true, query: '?url', import: 'default' });

/** Every bread starts as the same dough ball: Mix and Shape live with the default bread. Proof, Bake and Baked are each bread's own. */
const SHARED_STAGES: readonly Stage[] = ['mix', 'shape'];

export function loafArtUrl(bread: BreadId, stage: Stage): string {
  const folder = SHARED_STAGES.includes(stage) ? DEFAULT_BREAD : bread;
  return stageUrls[`../../design/loaves/${folder}/${stage}.svg`] ?? '';
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
