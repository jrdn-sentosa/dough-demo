/**
 * What a share picture says and where it points. Pure, with no React and no canvas.
 *
 * Nothing here takes a balance, a goal or any other money figure, so the picture can't show one: the only
 * inputs are which moment it is (`ShareKind`), the lines of copy and the app's address.
 */

export type ShareKind = 'baked' | 'mastered';
export type ShareSize = 'story' | 'post';

/** Pixel sizes: a tall story and a square post. */
export const CARD_SIZES: Record<ShareSize, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1080 },
};

/** The lines of copy the picture needs (from `content/share.json`). */
export interface ShareLines {
  baked: string;
  mastered: string;
  tagline: string;
}

export interface CardContent {
  /** "I just baked my emergency fund loaf" or "I mastered the emergency fund lessons". */
  headline: string;
  /** "Stack that bread." */
  tagline: string;
  /** The app's address without "https://" (empty when there is none). */
  address: string;
}

/**
 * The one place a share link is built. Today it is just the app's address. A referral code goes in `ref`
 * (it becomes `?ref=<code>`) when referrals exist; nothing else should put a link together.
 * An address that isn't a real URL gives an empty link, so a share still works without one.
 */
export function buildShareLink({ origin, ref }: { origin: string; ref?: string }): string {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    if (ref) url.searchParams.set('ref', ref);
    return url.toString();
  } catch {
    return '';
  }
}

/** The part of a link shown on the picture: the host, with no protocol, path or query. */
export function addressOf(link: string): string {
  try {
    return new URL(link).host;
  } catch {
    return '';
  }
}

export function shareCardContent(kind: ShareKind, lines: ShareLines, link: string): CardContent {
  return { headline: lines[kind], tagline: lines.tagline, address: addressOf(link) };
}

/** The text that goes with the picture, and what "Copy text" copies. */
export function shareText(kind: ShareKind, lines: ShareLines, link: string): string {
  return [lines[kind], lines.tagline, link].filter((part) => part !== '').join('\n');
}

export function cardFileName(kind: ShareKind, size: ShareSize): string {
  return `dough-${kind}-${size}.png`;
}
