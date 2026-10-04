import { describe, expect, it } from 'vitest';
import { BREAD_IDS, DEFAULT_BREAD, UNLOCKABLE_BREADS } from '../domain/breads';
import type { Stage } from '../domain/types';
import { loafArtUrl } from './loafArt';

const STAGES: readonly Stage[] = ['mix', 'shape', 'proof', 'bake', 'baked'];
const OWN_STAGES: readonly Stage[] = ['proof', 'bake', 'baked'];

describe('bread art coverage', () => {
  it('has a picture for every bread at every stage', () => {
    for (const bread of BREAD_IDS) {
      for (const stage of STAGES) {
        expect(loafArtUrl(bread, stage), `${bread} ${stage}`).not.toBe('');
      }
    }
  });

  it('shares the dough ball: Mix and Shape are the same picture for every bread', () => {
    for (const stage of ['mix', 'shape'] as const) {
      const shared = loafArtUrl(DEFAULT_BREAD, stage);
      for (const bread of UNLOCKABLE_BREADS) expect(loafArtUrl(bread, stage)).toBe(shared);
    }
  });

  it('gives each bread its own Proof, Bake and Baked, different from every other bread', () => {
    for (const stage of OWN_STAGES) {
      const urls = BREAD_IDS.map((bread) => loafArtUrl(bread, stage));
      expect(new Set(urls).size, stage).toBe(BREAD_IDS.length);
    }
  });

  it('keeps each stage of a bread distinct, so a rising loaf visibly changes', () => {
    for (const bread of BREAD_IDS) {
      const urls = STAGES.map((stage) => loafArtUrl(bread, stage));
      expect(new Set(urls).size, bread).toBe(STAGES.length);
    }
  });
});
