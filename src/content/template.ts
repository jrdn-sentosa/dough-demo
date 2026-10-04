/**
 * Fills `{token}` placeholders in content. Money in content is a token, never a
 * typed figure, so copy can't drift from the value the app uses. An unknown
 * token throws, so a typo shows up in tests instead of on screen.
 */
export function fillTemplate(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`Unknown placeholder {${name}} in content`);
    return value;
  });
}
