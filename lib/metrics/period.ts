export type PeriodKey =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "mtd"
  | "qtd"
  | "ytd"
  | "all";

export type ResolvedPeriod = {
  key: PeriodKey;
  startDate: string;
  endDate: string;
};

const periodKeys: PeriodKey[] = ["today", "7d", "30d", "90d", "mtd", "qtd", "ytd", "all"];

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isPeriodKey(value: unknown): value is PeriodKey {
  return typeof value === "string" && periodKeys.includes(value as PeriodKey);
}

export function resolvePeriod(key: PeriodKey = "30d", now = new Date()): ResolvedPeriod {
  const end = startOfUtcDay(now);
  let start = end;

  if (key === "today") {
    return { key, startDate: toDateOnly(start), endDate: toDateOnly(end) };
  }

  if (key === "7d" || key === "30d" || key === "90d") {
    const days = Number(key.replace("d", ""));
    start = addUtcDays(end, -(days - 1));
    return { key, startDate: toDateOnly(start), endDate: toDateOnly(end) };
  }

  if (key === "mtd") {
    start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    return { key, startDate: toDateOnly(start), endDate: toDateOnly(end) };
  }

  if (key === "qtd") {
    const quarter = Math.floor(end.getUTCMonth() / 3);
    start = new Date(Date.UTC(end.getUTCFullYear(), quarter * 3, 1));
    return { key, startDate: toDateOnly(start), endDate: toDateOnly(end) };
  }

  if (key === "ytd") {
    start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
    return { key, startDate: toDateOnly(start), endDate: toDateOnly(end) };
  }

  return { key: "all", startDate: "1970-01-01", endDate: toDateOnly(end) };
}
