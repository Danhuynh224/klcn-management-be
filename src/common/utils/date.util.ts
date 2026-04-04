export function toIsoNow(): string {
  return new Date().toISOString();
}

export function isNowWithin(startAt: string, endAt: string): boolean {
  const now = Date.now();
  return now >= new Date(startAt).getTime() && now <= new Date(endAt).getTime();
}

export function isTruthy(
  value: boolean | string | number | undefined,
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return String(value).toLowerCase() === 'true';
}
