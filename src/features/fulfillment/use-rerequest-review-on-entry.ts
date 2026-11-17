"use client";

import { useEffect, useEffectEvent, useRef } from "react";

export function useRerequestReviewOnEntry(key: string, open: () => void) {
  const opened = useRef("");
  const openLatest = useEffectEvent(open);
  useEffect(() => {
    if (!key || opened.current === key) return;
    opened.current = key;
    openLatest();
  }, [key]);
}
