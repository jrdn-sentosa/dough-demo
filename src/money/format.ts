/** Display only. Money is stored as integer cents everywhere else. */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  const whole = Number.isInteger(dollars);
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
