export function toNumber(value: number | string | undefined): number {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value ?? 0);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function calculateAverage(scores: Array<number | string>): number {
  if (scores.length === 0) {
    return 0;
  }

  const total = scores.reduce<number>((sum, score) => sum + toNumber(score), 0);
  return Number((total / scores.length).toFixed(2));
}
