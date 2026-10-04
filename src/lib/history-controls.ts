import { getOperatingDateFromIso, isIsoOperatingDate } from "@/lib/emr-domain/demo-date";

export type HistorySortDirection = "newest" | "oldest";
export type HistoryDateRange = { start: string; end: string };
export const emptyHistoryDateRange: HistoryDateRange = { start: "", end: "" };

export function getHistoryDateRangeError(range: HistoryDateRange, required = false) {
  if (!range.start && !range.end && !required) return undefined;
  if (!range.start || !range.end) return "시작일과 종료일을 모두 입력해 주세요.";
  if (!isIsoOperatingDate(range.start) || !isIsoOperatingDate(range.end)) {
    return "올바른 날짜를 입력해 주세요.";
  }
  if (range.start > range.end) return "종료일은 시작일 이후로 선택해 주세요.";
  return undefined;
}

export function matchesHistoryDate(dateTime: string | undefined, range: HistoryDateRange) {
  if (!range.start && !range.end) return true;
  const date = getOperatingDateFromIso(dateTime);
  return Boolean(date && (!range.start || date >= range.start) && (!range.end || date <= range.end));
}

export function matchesHistoryQuery(query: string, fields: Array<string | undefined>) {
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ko-KR");
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const text = normalize(fields.filter(Boolean).join(" "));
  return words.every((word) => text.includes(word));
}

export function compareHistoryDates(a: string | undefined, b: string | undefined, direction: HistorySortDirection) {
  const left = a ? Date.parse(a) : NaN;
  const right = b ? Date.parse(b) : NaN;
  if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
  if (!Number.isFinite(right)) return -1;
  return direction === "newest" ? right - left : left - right;
}
