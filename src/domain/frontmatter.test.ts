import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from './frontmatter';

describe('parseFrontmatter', () => {
  it('parses scalars and returns the body', () => {
    const src = [
      '---',
      'id: ef-what-its-for',
      'title: "What an emergency fund is for"',
      "subtitle: 'Quick one'",
      'order: 1',
      'seconds: 95.5',
      'draft: true',
      'video: false',
      'poster: null',
      '---',
      '',
      'Body text.',
    ].join('\n');
    expect(parseFrontmatter(src)).toEqual({
      data: {
        id: 'ef-what-its-for',
        title: 'What an emergency fund is for',
        subtitle: 'Quick one',
        order: 1,
        seconds: 95.5,
        draft: true,
        video: false,
        poster: null,
      },
      body: 'Body text.',
    });
  });

  it('parses inline lists, including quoted commas', () => {
    const { data } = parseFrontmatter('---\ntags: [a, "b, c", \'d\']\nnone: []\n---\n');
    expect(data.tags).toEqual(['a', 'b, c', 'd']);
    expect(data.none).toEqual([]);
  });

  it('parses block lists', () => {
    const { data } = parseFrontmatter('---\ncaptions:\n  - en.vtt\n  - es.vtt\nafter: 2\n---\nBody');
    expect(data.captions).toEqual(['en.vtt', 'es.vtt']);
    expect(data.after).toBe(2);
  });

  it('keeps colons inside values', () => {
    expect(parseFrontmatter('---\ntitle: Where to keep it: high-yield savings\n---\n').data.title).toBe(
      'Where to keep it: high-yield savings',
    );
  });

  it('treats an empty key with no items as null', () => {
    expect(parseFrontmatter('---\nposter:\n---\n').data.poster).toBeNull();
  });

  it('skips blank lines and comments', () => {
    expect(parseFrontmatter('---\n# note\n\na: 1\n---\n').data).toEqual({ a: 1 });
  });

  it('handles CRLF line endings', () => {
    expect(parseFrontmatter('---\r\na: 1\r\n---\r\nBody\r\n')).toEqual({
      data: { a: 1 },
      body: 'Body\n',
    });
  });

  it('returns the whole text as body when there is no frontmatter', () => {
    expect(parseFrontmatter('Just text')).toEqual({ data: {}, body: 'Just text' });
  });

  it('returns the whole text when the block is never closed', () => {
    expect(parseFrontmatter('---\na: 1\nno end')).toEqual({ data: {}, body: '---\na: 1\nno end' });
  });
});
