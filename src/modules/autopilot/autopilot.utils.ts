export function buildDailyCronExpression(postingTime: string): string {
  const normalized = postingTime.trim().toLowerCase();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);

  if (!match) {
    throw new Error(`Unsupported posting time format: ${postingTime}`);
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const suffix = match[3];

  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Unsupported posting time format: ${postingTime}`);
  }

  return `${minute} ${hour} * * *`;
}

export function computeBackoffDelayMs(attempt: number): number {
  const baseDelayMs = 1000;
  return baseDelayMs * Math.pow(2, Math.max(0, attempt));
}
