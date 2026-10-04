import { afterEach, describe, expect, it, vi } from 'vitest';
import shareJson from '../../content/share.json';
import { getShare, parseShare } from '../content/loader';
import { ContentError } from '../content/guards';
import { addressOf, buildShareLink, CARD_SIZES, cardFileName, shareCardContent, shareText } from './share';
import type { ShareKind } from './share';

afterEach(() => vi.unstubAllEnvs());

const lines = getShare().card;
const kinds: ShareKind[] = ['baked', 'mastered'];

/** Same patterns as the financial-copy rules in `loader.test.ts`, plus any digit at all. */
const MONEY = [/\$/, /\d/, /%/, /\bAPY\b/i, /\b(dollars?|cents?|balance|goal|target|saved|savings)\b/i];

function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

describe('share card content', () => {
  it.each(kinds)('%s: says the line from content, the tagline and the host', (kind) => {
    const card = shareCardContent(kind, lines, 'https://dough.example/');
    expect(card).toEqual({ headline: lines[kind], tagline: 'Stack that bread.', address: 'dough.example' });
  });

  it('uses the lines the brief asks for', () => {
    expect(lines.baked).toBe('I just baked my emergency fund loaf');
    expect(lines.mastered).toBe('I mastered the emergency fund lessons');
  });

  it.each(kinds)('%s: no money appears on the card or in the copied text', (kind) => {
    const link = buildShareLink({ origin: 'https://dough.example' });
    const card = shareCardContent(kind, lines, link);
    const everything = [...Object.values(card), shareText(kind, lines, link)];
    for (const text of everything) for (const pattern of MONEY) expect(text).not.toMatch(pattern);
  });

  it('takes nothing about money: the only inputs are the kind, the copy and the link', () => {
    expect(shareCardContent.length).toBe(3);
    expect(Object.keys(shareCardContent('baked', lines, 'https://a.b/')).sort()).toEqual(['address', 'headline', 'tagline']);
  });
});

describe('content/share.json', () => {
  it('is a draft file with a boolean flag', () => {
    expect(typeof getShare().draft).toBe('boolean');
    expect(shareJson.draft).toBe(true);
  });

  it('has no amounts, tokens, or guilt words anywhere', () => {
    const guilt = /\b(lost|lose|loses|losing|broke|broken|failed|fail|fails|failure|missed|miss|shame|punish\w*)\b/i;
    for (const text of allStrings(shareJson)) {
      expect(text).not.toMatch(/\$|\d|%|\{/);
      expect(text).not.toMatch(guilt);
    }
  });

  it('names no bank or app', () => {
    for (const text of allStrings(shareJson)) expect(text).not.toMatch(/\b(chase|venmo|robinhood|plaid|ally|capital one)\b/i);
  });

  it('throws when a line is missing', () => {
    expect(() => parseShare({ ...shareJson, card: { baked: 'x', mastered: 'y' } })).toThrow(ContentError);
    expect(() => parseShare({ ...shareJson, draft: 'yes' })).toThrow(ContentError);
  });
});

describe('buildShareLink', () => {
  it('is the app address, with a single trailing slash', () => {
    expect(buildShareLink({ origin: 'https://dough.example' })).toBe('https://dough.example/');
    expect(buildShareLink({ origin: 'https://dough.example/' })).toBe('https://dough.example/');
  });

  it('drops any path, query and hash so nothing about where the student was leaks out', () => {
    expect(buildShareLink({ origin: 'https://dough.example/loaf-complete?demo=1#top' })).toBe('https://dough.example/');
  });

  it('keeps a port for local testing', () => {
    expect(buildShareLink({ origin: 'http://localhost:5173' })).toBe('http://localhost:5173/');
  });

  it('adds a referral code only when one is given', () => {
    expect(buildShareLink({ origin: 'https://dough.example' })).not.toContain('ref');
    expect(buildShareLink({ origin: 'https://dough.example', ref: 'abc123' })).toBe('https://dough.example/?ref=abc123');
    expect(buildShareLink({ origin: 'https://dough.example', ref: 'a b&c' })).toBe('https://dough.example/?ref=a+b%26c');
  });

  it('uses the fixed app address when one is set, whatever the page address is', () => {
    const appUrl = 'https://dough-demo.vercel.app';
    expect(buildShareLink({ origin: 'https://branch-abc.vercel.app', appUrl })).toBe('https://dough-demo.vercel.app/');
    expect(buildShareLink({ origin: 'http://localhost:5173', appUrl: ` ${appUrl}/some/path?x=1 ` })).toBe('https://dough-demo.vercel.app/');
    expect(buildShareLink({ origin: 'http://localhost:5173', appUrl, ref: 'abc' })).toBe('https://dough-demo.vercel.app/?ref=abc');
    expect(shareCardContent('baked', lines, buildShareLink({ origin: 'http://localhost:5173', appUrl })).address).toBe('dough-demo.vercel.app');
  });

  it('falls back to the page address when the fixed one is empty or missing', () => {
    expect(buildShareLink({ origin: 'https://branch-abc.vercel.app', appUrl: '' })).toBe('https://branch-abc.vercel.app/');
    expect(buildShareLink({ origin: 'https://branch-abc.vercel.app', appUrl: '  ' })).toBe('https://branch-abc.vercel.app/');
    expect(buildShareLink({ origin: 'https://branch-abc.vercel.app', appUrl: undefined })).toBe('https://branch-abc.vercel.app/');
  });

  it('falls back to the page address and warns, naming the value, when the fixed one is not a web address', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const appUrl of ['dough-demo.vercel.app', 'ftp://dough.example', 'javascript:alert(1)']) {
      expect(buildShareLink({ origin: 'https://branch-abc.vercel.app', appUrl })).toBe('https://branch-abc.vercel.app/');
      expect(warn).toHaveBeenLastCalledWith(expect.stringContaining(JSON.stringify(appUrl)));
    }
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('warns once per bad value, not on every call, and never for an empty or good one', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 3; i++) buildShareLink({ origin: 'https://a.example', appUrl: 'not a url, once' });
    expect(warn).toHaveBeenCalledTimes(1);
    buildShareLink({ origin: 'https://a.example', appUrl: '' });
    buildShareLink({ origin: 'https://a.example', appUrl: 'https://dough-demo.vercel.app' });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('reads VITE_APP_URL by itself when no address is passed', () => {
    vi.stubEnv('VITE_APP_URL', 'https://dough-demo.vercel.app');
    expect(buildShareLink({ origin: 'http://localhost:5173' })).toBe('https://dough-demo.vercel.app/');
    vi.stubEnv('VITE_APP_URL', '');
    expect(buildShareLink({ origin: 'http://localhost:5173' })).toBe('http://localhost:5173/');
    vi.unstubAllEnvs();
  });

  it('gives an empty link for an address that is not a web address', () => {
    for (const origin of ['', 'null', 'file:///x', 'javascript:alert(1)']) expect(buildShareLink({ origin })).toBe('');
  });
});

describe('addresses and text', () => {
  it('shows the host without protocol, path or query', () => {
    expect(addressOf('https://dough.example/?ref=abc')).toBe('dough.example');
    expect(addressOf('')).toBe('');
  });

  it('the copied text is the line, the tagline and the link, one per line', () => {
    expect(shareText('baked', lines, 'https://dough.example/')).toBe(
      'I just baked my emergency fund loaf\nStack that bread.\nhttps://dough.example/',
    );
  });

  it('leaves the link out when there is none', () => {
    expect(shareText('mastered', lines, '')).toBe('I mastered the emergency fund lessons\nStack that bread.');
    expect(shareCardContent('mastered', lines, '').address).toBe('');
  });
});

describe('sizes and file names', () => {
  it('has the story and post sizes', () => {
    expect(CARD_SIZES.story).toEqual({ width: 1080, height: 1920 });
    expect(CARD_SIZES.post).toEqual({ width: 1080, height: 1080 });
  });

  it('names files by kind and shape', () => {
    expect(cardFileName('baked', 'story')).toBe('dough-baked-story.png');
    expect(cardFileName('mastered', 'post')).toBe('dough-mastered-post.png');
  });
});
