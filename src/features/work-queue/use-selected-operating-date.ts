"use client";

import { useCallback, useEffect, useState } from "react";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";

export function useSelectedOperatingDate(workspaceId: string) {
  const [todayDate, setTodayDate] = useState(() =>
    getWorkspaceOperatingDate(workspaceId),
  );
  const [selectedDate, setSelectedDate] = useState(todayDate);

  const refreshTodayDate = useCallback(() => {
    setTodayDate(getWorkspaceOperatingDate(workspaceId));
  }, [workspaceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.addEventListener("focus", refreshTodayDate);
    const intervalId = window.setInterval(refreshTodayDate, 60_000);

    return () => {
      window.removeEventListener("focus", refreshTodayDate);
      window.clearInterval(intervalId);
    };
  }, [refreshTodayDate]);

  return {
    isToday: selectedDate === todayDate,
    resetToToday: () => setSelectedDate(todayDate),
    selectDate: setSelectedDate,
    selectedDate,
    todayDate,
  };
}
