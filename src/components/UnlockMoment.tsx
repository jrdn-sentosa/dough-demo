import type { BreadsContent } from '../content/types';
import { fillTemplate } from '../content/template';
import type { UnlockableBread } from '../domain/breads';
import { loafArtUrl } from './loafArt';

/**
 * A new bread has been unlocked. A light moment on Home, much smaller than a baked loaf's celebration:
 * no confetti, a short entrance, and a dismiss button. It stays until the student dismisses it.
 */
export function UnlockMoment({ bread, copy, onDismiss }: { bread: UnlockableBread; copy: BreadsContent; onDismiss: () => void }) {
  const name = copy.names[bread];
  return (
    <div className="unlock-moment" role="status">
      <img className="unlock-moment__art" src={loafArtUrl(bread, 'bake')} alt="" aria-hidden="true" />
      <div className="unlock-moment__text">
        <span className="unlock-moment__title">{fillTemplate(copy.unlock.title, { bread: name })}</span>
        <span className="unlock-moment__body">{copy.unlock.body}</span>
      </div>
      <button type="button" className="text-button" onClick={onDismiss}>
        {copy.unlock.dismiss}
      </button>
    </div>
  );
}
