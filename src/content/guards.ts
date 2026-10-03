/** Small runtime checks for bundled content. Malformed content throws at load time. */

export class ContentError extends Error {
  constructor(where: string, message: string) {
    super(`Content error in ${where}: ${message}`);
    this.name = 'ContentError';
  }
}

export type Obj = Record<string, unknown>;

export function obj(value: unknown, where: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ContentError(where, 'expected an object');
  }
  return value as Obj;
}

export function str(o: Obj, key: string, where: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ContentError(where, `"${key}" must be a non-empty string`);
  }
  return v;
}

export function optStr(o: Obj, key: string, where: string): string | null {
  const v = o[key];
  if (v === undefined || v === null) return null;
  return str(o, key, where);
}

export function num(o: Obj, key: string, where: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ContentError(where, `"${key}" must be a number`);
  }
  return v;
}

export function bool(o: Obj, key: string, where: string): boolean {
  const v = o[key];
  if (typeof v !== 'boolean') throw new ContentError(where, `"${key}" must be true or false`);
  return v;
}

export function arr(o: Obj, key: string, where: string): unknown[] {
  const v = o[key];
  if (!Array.isArray(v) || v.length === 0) {
    throw new ContentError(where, `"${key}" must be a non-empty list`);
  }
  return v;
}

export function oneOf<T extends string>(
  o: Obj,
  key: string,
  allowed: readonly T[],
  where: string,
): T {
  const v = str(o, key, where);
  if (!(allowed as readonly string[]).includes(v)) {
    throw new ContentError(where, `"${key}" must be one of: ${allowed.join(', ')}`);
  }
  return v as T;
}
