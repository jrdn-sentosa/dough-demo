import type { BreadId } from '../domain/breads';
import { CARD_SIZES, type CardContent, type ShareSize } from '../domain/share';
import { GOLD, GOLDEN_FINISH_BOX, GOLDEN_SPARKLES, GOLDEN_SWEEP, GOLDEN_SWEEP_WIDTH } from '../components/goldenFinishArt';
import { loafArtUrl } from '../components/loafArt';

/** The palette from `tokens.css`. A canvas can't read CSS variables, so the values are copied here. */
export const CARD_COLORS = {
  ground: '#FFFFFF',
  crumb: '#FFF6E6',
  crust: '#8A4B1F',
  rye: '#2B1B12',
  textMuted: '#6B5446',
  divider: '#EADBC4',
} as const;

/** The families `tokens.css` sets (the variable fonts from @fontsource-variable). */
export const CARD_FONTS = {
  display: '"Fraunces Variable", Georgia, serif',
  body: '"DM Sans Variable", system-ui, sans-serif',
} as const;

/** The part of a canvas the card needs, so tests can pass a stand-in. */
export interface CardCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D | null;
  toBlob(callback: (blob: Blob | null) => void, type?: string): void;
}

export interface RenderDeps {
  createCanvas: (width: number, height: number) => CardCanvas;
  loadImage: (url: string) => Promise<CanvasImageSource>;
  /** Resolves once the app fonts are ready to draw `texts`. Must resolve before anything is drawn. */
  fontsReady: (texts: string[]) => Promise<void>;
}

export interface CardRequest {
  size: ShareSize;
  content: CardContent;
  bread: BreadId;
  /** The golden finish and sparkles. */
  mastered: boolean;
}

interface Layout {
  wordmarkY: number;
  wordmarkSize: number;
  panelTop: number;
  panelHeight: number;
  loafWidth: number;
  headlineY: number;
  headlineSize: number;
  taglineSize: number;
  addressY: number;
  addressSize: number;
}

const LAYOUTS: Record<ShareSize, Layout> = {
  story: { wordmarkY: 230, wordmarkSize: 110, panelTop: 380, panelHeight: 820, loafWidth: 820, headlineY: 1330, headlineSize: 88, taglineSize: 56, addressY: 1790, addressSize: 44 },
  post: { wordmarkY: 150, wordmarkSize: 80, panelTop: 230, panelHeight: 470, loafWidth: 500, headlineY: 800, headlineSize: 62, taglineSize: 44, addressY: 1010, addressSize: 38 },
};

const SIDE_MARGIN = 80;
const LOAF_RATIO = GOLDEN_FINISH_BOX.height / GOLDEN_FINISH_BOX.width;

/** Waits for the app's fonts. Without this a canvas quietly draws in a fallback font. */
export async function waitForAppFonts(texts: string[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const sample = texts.join(' ');
  await Promise.all([
    document.fonts.load('700 64px "Fraunces Variable"', sample),
    document.fonts.load('700 40px "DM Sans Variable"', sample),
    document.fonts.load('500 40px "DM Sans Variable"', sample),
  ]);
  await document.fonts.ready;
}

export const browserDeps: RenderDeps = {
  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  },
  loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('the loaf picture did not load'));
      img.src = url;
    });
  },
  fontsReady: waitForAppFonts,
};

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Breaks `text` into lines no wider than `maxWidth`, using the font already set on `ctx`. */
export function wrapLines(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line === '' ? word : `${line} ${word}`;
    if (line !== '' && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

function drawGoldenFinish(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / GOLDEN_FINISH_BOX.width, width / GOLDEN_FINISH_BOX.width);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = GOLDEN_SWEEP_WIDTH.withSparkles;
  ctx.lineCap = 'round';
  ctx.stroke(new Path2D(GOLDEN_SWEEP));
  ctx.globalAlpha = 1;
  ctx.fillStyle = GOLD;
  for (const d of GOLDEN_SPARKLES) ctx.fill(new Path2D(d));
  ctx.restore();
}

/**
 * Draws the share picture and returns it as a PNG. Fonts are awaited before the first draw call.
 * The only inputs are the card's lines, the bread and whether the lessons are mastered.
 */
export async function renderCard(request: CardRequest, deps: RenderDeps = browserDeps): Promise<Blob> {
  const { size, content, bread, mastered } = request;
  const { width, height } = CARD_SIZES[size];
  const layout = LAYOUTS[size];

  await deps.fontsReady(['Dough!', content.headline, content.tagline, content.address]);
  const loaf = await deps.loadImage(loafArtUrl(bread, 'baked'));

  const canvas = deps.createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas is not available');

  ctx.fillStyle = CARD_COLORS.ground;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = CARD_COLORS.crust;
  ctx.font = `700 ${layout.wordmarkSize}px ${CARD_FONTS.display}`;
  ctx.fillText('Dough!', width / 2, layout.wordmarkY);

  ctx.fillStyle = CARD_COLORS.crumb;
  roundedRect(ctx, SIDE_MARGIN, layout.panelTop, width - SIDE_MARGIN * 2, layout.panelHeight, 80);
  ctx.fill();

  const loafHeight = layout.loafWidth * LOAF_RATIO;
  const loafX = (width - layout.loafWidth) / 2;
  const loafY = layout.panelTop + (layout.panelHeight - loafHeight) / 2;
  ctx.drawImage(loaf, loafX, loafY, layout.loafWidth, loafHeight);
  if (mastered) drawGoldenFinish(ctx, loafX, loafY, layout.loafWidth);

  ctx.fillStyle = CARD_COLORS.rye;
  ctx.font = `700 ${layout.headlineSize}px ${CARD_FONTS.display}`;
  const lineHeight = layout.headlineSize * 1.15;
  const lines = wrapLines(ctx, content.headline, width - SIDE_MARGIN * 2 - 40);
  lines.forEach((line, i) => ctx.fillText(line, width / 2, layout.headlineY + i * lineHeight));

  ctx.fillStyle = CARD_COLORS.crust;
  ctx.font = `700 ${layout.taglineSize}px ${CARD_FONTS.body}`;
  ctx.fillText(content.tagline, width / 2, layout.headlineY + lines.length * lineHeight + layout.taglineSize * 0.4);

  if (content.address !== '') {
    ctx.fillStyle = CARD_COLORS.textMuted;
    ctx.font = `500 ${layout.addressSize}px ${CARD_FONTS.body}`;
    ctx.fillText(content.address, width / 2, layout.addressY);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('could not make the picture'))), 'image/png');
  });
}
