"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentOperatingDate, getWorkspaceOperatingDate, isIsoOperatingDate } from "@/lib/emr-domain/demo-date";
import { getAuthRuntimeMode } from "@/lib/supabase/config";
import { useModuleSidePanel } from "@/components/emr/module-side-panel-context";

export function useSelectedOperatingDate(workspaceId: string, requestedDate?: string | null) {
  const panel = useModuleSidePanel();
  const visible = panel?.visible !== false;
  const [todayDate, setTodayDate] = useState(() =>
    getAuthRuntimeMode().authProvider === "supabase"
      ? getCurrentOperatingDate()
      : getWorkspaceOperatingDate(workspaceId),
  );
  const initialDate = requestedDate && isIsoOperatingDate(requestedDate) ? requestedDate : todayDate;
  const selectionKey = `${workspaceId}:${requestedDate ?? ""}`;
  const [selection, setSelection] = useState({ key: selectionKey, date: initialDate });
  const selectedDate = selection.key === selectionKey ? selection.date : initialDate;
  const setSelectedDate = (date: string) => setSelection({ key: selectionKey, date });

  const refreshTodayDate = useCallback(() => {
    setTodayDate(getAuthRuntimeMode().authProvider === "supabase"
      ? getCurrentOperatingDate()
      : getWorkspaceOperatingDate(workspaceId));
  }, [workspaceId]);

  useEffect(() => {
    if (typeof window === "undefined" || !visible) return;

    const resumeId = window.setTimeout(refreshTodayDate, 0);
    window.addEventListener("focus", refreshTodayDate);
    const intervalId = window.setInterval(refreshTodayDate, 60_000);

    return () => {
      window.clearTimeout(resumeId);
      window.removeEventListener("focus", refreshTodayDate);
      window.clearInterval(intervalId);
    };
  }, [refreshTodayDate, visible]);

  return {
    isToday: selectedDate === todayDate,
    resetToToday: () => setSelectedDate(todayDate),
    selectDate: setSelectedDate,
    selectedDate,
    todayDate,
  };
}
