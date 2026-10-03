export type FrontmatterValue = string | number | boolean | null | string[];

export interface Parsed {
  data: Record<string, FrontmatterValue>;
  body: string;
}

function unquote(raw: string): string {
  const s = raw.trim();
  if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s.endsWith(s[0])) return s.slice(1, -1);
  return s;
}

function scalar(raw: string): string | number | boolean | null {
  const s = raw.trim();
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return unquote(s);
}

function splitInlineList(inner: string): string[] {
  const items: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (const ch of inner) {
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ',') {
      items.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  items.push(current);
  return items.map(unquote).filter((s) => s !== '');
}

/**
 * Small frontmatter parser: a `---` block of `key: value` lines at the top.
 * Supports strings (plain or quoted), numbers, booleans, null, inline lists
 * `[a, b]`, and block lists (`key:` followed by `- item` lines).
 * An empty `key:` with no list items below it is null.
 */
export function parseFrontmatter(source: string): Parsed {
  const text = source.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return { data: {}, body: text };

  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end === -1) return { data: {}, body: text };

  const data: Record<string, FrontmatterValue> = {};
  let listKey: string | null = null;

  for (const line of lines.slice(1, end)) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) {
      const current = data[listKey];
      data[listKey] = [...(Array.isArray(current) ? current : []), unquote(item[1])];
      continue;
    }

    const kv = /^([A-Za-z0-9_-]+):(?:\s+(.*))?$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    const value = (kv[2] ?? '').trim();

    if (value === '') {
      data[key] = null;
      listKey = key;
    } else if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = splitInlineList(value.slice(1, -1));
      listKey = null;
    } else {
      data[key] = scalar(value);
      listKey = null;
    }
  }

  return { data, body: lines.slice(end + 1).join('\n').replace(/^\n/, '') };
}
