export type LoafId = 'emergency-fund' | 'index-funds' | 'bonds' | 'roth-ira' | 'debt-payoff';

export type Stage = 'mix' | 'shape' | 'proof' | 'bake' | 'baked';

export type AccountType =
  | 'checking'
  | 'regular-savings'
  | 'high-yield-savings'
  | 'retirement'
  | 'investment'
  | 'none'
  | 'not-sure';

export type CardDebt = 'yes' | 'no' | 'no-card';

/** Money bands use integer cents. `maxCents` is inclusive, `null` means open-ended. */
export interface EssentialsBand {
  id: string;
  kind: 'range' | 'open' | 'unsure';
  minCents: number;
  maxCents: number | null;
}

export interface SavingsBand {
  id: string;
  minCents: number;
  maxCents: number | null;
}
