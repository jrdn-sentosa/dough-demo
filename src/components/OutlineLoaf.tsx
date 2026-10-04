import type { LoafId } from '../domain/types';
import { outlineFor, outlineUrl } from './loafArt';

/** The dashed outline for a loaf that is "Coming soon". Renders nothing for a loaf with real art. */
export function OutlineLoaf({ loafId, width = 84 }: { loafId: LoafId; width?: number }) {
  const name = outlineFor(loafId);
  if (!name) return null;
  return <img className="outline-loaf" src={outlineUrl(name)} alt="" aria-hidden="true" width={width} height={(width * 7) / 10} />;
}
