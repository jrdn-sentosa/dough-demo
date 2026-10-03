export const REBUILD_MESSAGE = "You used your fund for what it's for. Let's rebuild.";
export const STARTING_LABEL = 'Savings you already had';

export function withdrawalTooBigMessage(availableFormatted: string): string {
  return `You have ${availableFormatted} available to use right now.`;
}
