// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getShare } from '../content/loader';
import { buildShareLink, CARD_SIZES, shareCardContent } from '../domain/share';
import type { ShareKind, ShareSize } from '../domain/share';
import { CARD_COLORS, renderCard, wrapLines } from './renderCard';
import type { CardCanvas, RenderDeps } from './renderCard';

/** jsdom has no Path2D. The card only needs to know which path strings were drawn. */
class FakePath2D {
  constructor(public d: string) {}
}

beforeEach(() => vi.stubGlobal('Path2D', FakePath2D));
afterEach(() => vi.unstubAllGlobals());

interface Recorded {
  events: string[];
  texts: string[];
  fills: string[];
  paths: string[];
  canvases: { width: number; height: number }[];
}

/** A canvas stand-in that records what is drawn, in order. */
function fakeDeps(opts: { fontsDelay?: Promise<void>; noContext?: boolean } = {}): { deps: RenderDeps; rec: Recorded } {
  const rec: Recorded = { events: [], texts: [], fills: [], paths: [], canvases: [] };
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    fillRect: () => rec.events.push('draw'),
    fillText: (text: string) => {
      rec.events.push('draw');
      rec.texts.push(text);
    },
    drawImage: () => rec.events.push('draw'),
    measureText: (text: string) => ({ width: text.length * 20 }),
    beginPath: () => {},
    moveTo: () => {},
    arcTo: () => {},
    closePath: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    fill(arg?: unknown) {
      rec.events.push('draw');
      if (arg instanceof FakePath2D) rec.paths.push(arg.d);
      rec.fills.push(this.fillStyle);
    },
    stroke(arg?: unknown) {
      rec.events.push('draw');
      if (arg instanceof FakePath2D) rec.paths.push(arg.d);
    },
  };
  const deps: RenderDeps = {
    fontsReady: async () => {
      await opts.fontsDelay;
      rec.events.push('fonts');
    },
    loadImage: async () => ({}) as CanvasImageSource,
    createCanvas: (width, height): CardCanvas => {
      rec.canvases.push({ width, height });
      return {
        width,
        height,
        getContext: () => (opts.noContext ? null : (ctx as unknown as CanvasRenderingContext2D)),
        toBlob: (cb) => cb(new Blob(['png'], { type: 'image/png' })),
      };
    },
  };
  return { deps, rec };
}

const copy = getShare().card;
const link = buildShareLink({ origin: 'https://dough.example' });

function request(kind: ShareKind, size: ShareSize, mastered = kind === 'mastered') {
  return { size, content: shareCardContent(kind, copy, link), bread: 'sandwich' as const, mastered };
}

describe('renderCard', () => {
  it.each(['story', 'post'] as const)('%s is drawn at its full size and comes back as a PNG', async (size) => {
    const { deps, rec } = fakeDeps();
    const blob = await renderCard(request('baked', size), deps);
    expect(rec.canvases).toEqual([CARD_SIZES[size]]);
    expect(blob.type).toBe('image/png');
  });

  it('waits for the fonts before drawing anything', async () => {
    let release!: () => void;
    const { deps, rec } = fakeDeps({ fontsDelay: new Promise<void>((r) => (release = r)) });
    const done = renderCard(request('baked', 'story'), deps);
    await Promise.resolve();
    expect(rec.events).toEqual([]);
    release();
    await done;
    expect(rec.events[0]).toBe('fonts');
    expect(rec.events.slice(1).every((e) => e === 'draw')).toBe(true);
  });

  it('draws the golden finish and sparkles only when mastered', async () => {
    const plain = fakeDeps();
    await renderCard(request('baked', 'post', false), plain.deps);
    expect(plain.rec.paths).toEqual([]);

    const golden = fakeDeps();
    await renderCard(request('mastered', 'post'), golden.deps);
    expect(golden.rec.paths).toHaveLength(3);
    expect(golden.rec.fills).toContain('#F6C453');
  });

  it('draws only the content lines, the wordmark and the host: no money', async () => {
    for (const kind of ['baked', 'mastered'] as const) {
      for (const size of ['story', 'post'] as const) {
        const { deps, rec } = fakeDeps();
        await renderCard(request(kind, size), deps);
        const allowed = new Set(['Dough!', 'dough.example', ...copy.tagline.split(' '), ...copy[kind].split(' ')]);
        for (const word of rec.texts.flatMap((t) => t.split(' '))) expect(allowed.has(word)).toBe(true);
        for (const text of rec.texts) {
          expect(text).not.toMatch(/\$|%/);
          expect(text).not.toMatch(/\d/);
        }
        expect(rec.texts).toContain('Dough!');
        expect(rec.texts).toContain(copy.tagline);
        expect(rec.texts.join(' ')).toContain('dough.example');
      }
    }
  });

  it('leaves the address line out when there is no link', async () => {
    const { deps, rec } = fakeDeps();
    await renderCard({ ...request('baked', 'post'), content: shareCardContent('baked', copy, '') }, deps);
    expect(rec.texts).not.toContain('');
    expect(rec.texts).toHaveLength(['Dough!', copy.tagline].length + wrapLines({ measureText: (t) => ({ width: t.length * 20 }) as TextMetrics }, copy.baked, 920).length);
  });

  it('fails clearly when the canvas cannot draw', async () => {
    await expect(renderCard(request('baked', 'story'), fakeDeps({ noContext: true }).deps)).rejects.toThrow('canvas is not available');
  });

  it('uses the app palette', () => {
    expect(CARD_COLORS).toMatchObject({ ground: '#FFFFFF', crumb: '#FFF6E6', crust: '#8A4B1F', rye: '#2B1B12' });
  });
});

describe('wrapLines', () => {
  const measure = { measureText: (t: string) => ({ width: t.length * 10 }) as TextMetrics };

  it('breaks on spaces so no line is wider than the limit', () => {
    const lines = wrapLines(measure, 'I mastered the emergency fund lessons', 150);
    expect(lines.join(' ')).toBe('I mastered the emergency fund lessons');
    for (const line of lines) expect(line.length * 10).toBeLessThanOrEqual(150);
  });

  it('keeps one long word on its own line instead of dropping it', () => {
    expect(wrapLines(measure, 'supercalifragilistic is long', 100)).toEqual(['supercalifragilistic', 'is long']);
  });
});
