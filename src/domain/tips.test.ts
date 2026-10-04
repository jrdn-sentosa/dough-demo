import { describe, expect, it } from 'vitest';
import { isTipUnlocked, stageChange, tipId, tipStatus } from './tips';
import type { TipContext } from './tips';
import type { Stage } from './types';

const rising = (stage: Stage): TipContext => ({ stage, baked: false });
// The emergency fund's tips, in list order: shape, proof, bake, baked.
const tipStages: Stage[] = ['shape', 'proof', 'bake', 'baked'];

describe('tip unlocking', () => {
  it('opens tips as the loaf reaches their stage', () => {
    expect(tipStages.map((s) => isTipUnlocked(s, rising('mix')))).toEqual([false, false, false, false]);
    expect(tipStages.map((s) => isTipUnlocked(s, rising('shape')))).toEqual([true, false, false, false]);
    expect(tipStages.map((s) => isTipUnlocked(s, rising('proof')))).toEqual([true, true, false, false]);
    expect(tipStages.map((s) => isTipUnlocked(s, rising('bake')))).toEqual([true, true, true, false]);
    expect(tipStages.map((s) => isTipUnlocked(s, rising('baked')))).toEqual([true, true, true, true]);
  });

  it('keeps every tip open once the fund has baked, so a withdrawal never re-locks one', () => {
    for (const stage of ['mix', 'shape', 'proof'] as const) {
      expect(tipStages.every((s) => isTipUnlocked(s, { stage, baked: true }))).toBe(true);
    }
  });

  it('shows an unlocked tip as new until it has been opened', () => {
    expect(tipStatus('proof', rising('proof'), false)).toBe('new');
    expect(tipStatus('proof', rising('proof'), true)).toBe('unlocked');
    expect(tipStatus('bake', rising('proof'), false)).toBe('locked');
    expect(tipStatus('bake', rising('proof'), true)).toBe('locked');
  });

  it('saves seen tips by loaf and stage', () => {
    expect(tipId('emergency-fund', 'proof')).toBe('emergency-fund:proof');
  });
});

describe('stage change', () => {
  it('reports a move up and the tip it unlocked', () => {
    const change = stageChange(rising('shape'), rising('proof'), tipStages);
    expect(change).toEqual({ direction: 'up', stage: 'proof', newTips: [1] });
  });

  it('reports every tip unlocked by a jump, lowest stage first', () => {
    expect(stageChange(rising('mix'), rising('bake'), tipStages).newTips).toEqual([0, 1, 2]);
  });

  it('reports no tip when the stage has none (mix) or the stage did not change', () => {
    expect(stageChange(rising('shape'), rising('shape'), tipStages)).toEqual({ direction: null, stage: 'shape', newTips: [] });
    expect(stageChange({ stage: 'baked', baked: true }, rising('mix'), tipStages).newTips).toEqual([]);
  });

  it('reports a move down with nothing newly unlocked', () => {
    const change = stageChange(rising('bake'), rising('shape'), tipStages);
    expect(change).toEqual({ direction: 'down', stage: 'shape', newTips: [] });
  });

  it('counts the bake itself as unlocking the last tip', () => {
    const change = stageChange(rising('bake'), { stage: 'baked', baked: true }, tipStages);
    expect(change.newTips).toEqual([3]);
  });
});
