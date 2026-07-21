import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { addDaysToIsoDate } from "@/lib/emr-domain/demo-date";

export function ScheduleWeekNavigator({
  onChangeWeek,
  weekStart,
}: {
  onChangeWeek: (weekStart: string) => void;
  weekStart: string;
}) {
  return (
    <nav aria-label="근무표 주차 이동" className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="이전 주"
        onClick={() => onChangeWeek(addDaysToIsoDate(weekStart, -7))}
      >
        <ChevronLeftIcon aria-hidden="true" />
      </Button>
      <p className="min-w-40 text-center text-sm font-medium tabular-nums">
        {formatWeekLabel(weekStart)} 주
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="다음 주"
        onClick={() => onChangeWeek(addDaysToIsoDate(weekStart, 7))}
      >
        <ChevronRightIcon aria-hidden="true" />
      </Button>
    </nav>
  );
}

function formatWeekLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}
