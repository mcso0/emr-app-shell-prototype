"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CustomerProfileBillingProjection,
  CustomerProfileHistoryProjection,
  CustomerProfileOverview,
  CustomerProfileReservationProjection,
  CustomerProfileSection,
  CustomerProfileSubjectType,
} from "@/features/customer/server-profile-overview-core";

type LiveSectionItemMap = {
  history: CustomerProfileHistoryProjection;
  reservations: CustomerProfileReservationProjection;
  billing: CustomerProfileBillingProjection;
};

export type CustomerProfileSectionFilter = {
  month?: string;
  months?: 6 | 12;
  patientId?: string;
};

export type CustomerProfileSectionState<S extends CustomerProfileSection = CustomerProfileSection> = {
  errorStatus?: number;
  filterKey?: string;
  items: Array<LiveSectionItemMap[S]>;
  nextCursor: string | null;
  status: "idle" | "loading" | "ready" | "error" | "denied" | "not_found";
};

export type CustomerProfileOverviewState = {
  access: CustomerProfileOverview["access"] | null;
  errorStatus?: number;
  overview: CustomerProfileOverview | null;
  overviewStatus: "idle" | "loading" | "ready" | "error" | "denied" | "not_found";
  reloadOverview: () => void;
  loadSection: <S extends CustomerProfileSection>(
    section: S,
    filter?: CustomerProfileSectionFilter,
    options?: { append?: boolean; force?: boolean },
  ) => void;
  sectionStates: {
    history: CustomerProfileSectionState<"history">;
    reservations: CustomerProfileSectionState<"reservations">;
    billing: CustomerProfileSectionState<"billing">;
  };
};

const emptySectionState = <S extends CustomerProfileSection>(
  status: CustomerProfileSectionState<S>["status"] = "idle",
): CustomerProfileSectionState<S> => ({
  items: [],
  nextCursor: null,
  status,
});

export function useCustomerProfileOverview({
  enabled,
  subjectId,
  subjectType,
  workspaceId,
}: {
  enabled: boolean;
  subjectId: string;
  subjectType: CustomerProfileSubjectType;
  workspaceId: string;
}): CustomerProfileOverviewState {
  const scopeKey = JSON.stringify([workspaceId, subjectType, subjectId]);
  const [overviewScope, setOverviewScope] = useState<string | null>(null);
  const [overview, setOverview] = useState<CustomerProfileOverview | null>(null);
  const [overviewStatus, setOverviewStatus] = useState<CustomerProfileOverviewState["overviewStatus"]>(
    enabled ? "loading" : "idle",
  );
  const [errorStatus, setErrorStatus] = useState<number>();
  const [sectionStates, setSectionStates] = useState<CustomerProfileOverviewState["sectionStates"]>({
    history: emptySectionState("idle"),
    reservations: emptySectionState("idle"),
    billing: emptySectionState("idle"),
  });
  const requestVersion = useRef(0);
  const overviewController = useRef<AbortController | null>(null);
  const sectionControllers = useRef<Partial<Record<CustomerProfileSection, AbortController>>>({});

  const loadOverview = useCallback(() => {
    if (!enabled) return;
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    overviewController.current?.abort();
    Object.values(sectionControllers.current).forEach((controller) => controller?.abort());
    sectionControllers.current = {};
    const controller = new AbortController();
    overviewController.current = controller;
    setOverviewScope(scopeKey);
    setOverview(null);
    setErrorStatus(undefined);
    setOverviewStatus("loading");
    setSectionStates({
      history: emptySectionState("idle"),
      reservations: emptySectionState("idle"),
      billing: emptySectionState("idle"),
    });

    void fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/customer/${subjectType}/${encodeURIComponent(subjectId)}/profile-overview`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; overview?: CustomerProfileOverview; status?: number }
          | null;
        if (requestVersion.current !== version || controller.signal.aborted) return;
        if (!response.ok || !payload?.ok || !payload.overview) {
          setErrorStatus(response.status);
          setOverviewStatus(response.status === 401 || response.status === 403 ? "denied" : response.status === 404 ? "not_found" : "error");
          return;
        }
        if (
          payload.overview.subjectId !== subjectId ||
          payload.overview.subjectType !== subjectType ||
          payload.overview.profile.id !== subjectId ||
          (payload.overview.profile.workspaceId !== undefined &&
            payload.overview.profile.workspaceId !== workspaceId)
        ) {
          setErrorStatus(500);
          setOverviewStatus("error");
          return;
        }
        if (payload.overview.access.information?.allowed !== true) {
          setErrorStatus(403);
          setOverviewStatus("denied");
          return;
        }
        setOverview(payload.overview);
        setOverviewStatus("ready");
      })
      .catch((error: unknown) => {
        if (requestVersion.current !== version || controller.signal.aborted || isAbortError(error)) return;
        setErrorStatus(500);
        setOverviewStatus("error");
      });
  }, [enabled, scopeKey, subjectId, subjectType, workspaceId]);

  useEffect(() => {
    if (!enabled) {
      overviewController.current?.abort();
      Object.values(sectionControllers.current).forEach((controller) => controller?.abort());
      return;
    }
    const kickoff = window.setTimeout(() => loadOverview(), 0);
    return () => {
      window.clearTimeout(kickoff);
      overviewController.current?.abort();
      Object.values(sectionControllers.current).forEach((controller) => controller?.abort());
    };
  }, [enabled, loadOverview]);

  const loadSection = useCallback(
    <S extends CustomerProfileSection>(
      section: S,
      filter: CustomerProfileSectionFilter = {},
      options: { append?: boolean; force?: boolean } = {},
    ) => {
      if (!enabled || overviewScope !== scopeKey || !overview || !overview.access[section].allowed) {
        setSectionStates((current) => ({
          ...current,
          [section]: { ...emptySectionState("denied"), filterKey: serializeFilter(filter) },
        }));
        return;
      }
      const filterKey = serializeFilter(filter);
      const current = sectionStates[section] as CustomerProfileSectionState<S>;
      if (!options.force && !options.append && current.status === "ready" && current.filterKey === filterKey) {
        return;
      }
      sectionControllers.current[section]?.abort();
      const controller = new AbortController();
      sectionControllers.current[section] = controller;
      const cursor = options.append ? current.nextCursor : null;
      setSectionStates((state) => ({
        ...state,
        [section]: {
          ...state[section],
          filterKey,
          status: "loading",
          errorStatus: undefined,
          ...(options.append ? {} : { items: [], nextCursor: null }),
        },
      }));
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);
      if (filter.months) params.set("months", String(filter.months));
      if (filter.month) params.set("month", filter.month);
      if (filter.patientId) params.set("patientId", filter.patientId);
      const version = requestVersion.current;
      void fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/customer/${subjectType}/${encodeURIComponent(subjectId)}/profile-overview/${section}?${params.toString()}`,
        { cache: "no-store", signal: controller.signal },
      )
        .then(async (response) => {
          const payload = (await response.json().catch(() => null)) as
            | { items?: Array<LiveSectionItemMap[S]>; nextCursor?: string | null; ok?: boolean }
            | null;
          if (requestVersion.current !== version || controller.signal.aborted) return;
          if (response.status === 403) {
            setSectionStates((state) => ({
              ...state,
              [section]: { ...emptySectionState("denied"), filterKey, errorStatus: 403 },
            }));
            return;
          }
          if (response.status === 404) {
            setSectionStates((state) => ({
              ...state,
              [section]: { ...emptySectionState("not_found"), filterKey, errorStatus: 404 },
            }));
            return;
          }
          if (!response.ok || !payload?.ok) {
            setSectionStates((state) => ({
              ...state,
              [section]: { ...state[section], filterKey, status: "error", errorStatus: response.status || 500 },
            }));
            return;
          }
          setSectionStates((state) => {
            const previous = state[section] as CustomerProfileSectionState<S>;
            return {
              ...state,
              [section]: {
                filterKey,
                items: options.append ? [...previous.items, ...(payload.items ?? [])] : payload.items ?? [],
                nextCursor: payload.nextCursor ?? null,
                status: "ready",
              },
            };
          });
        })
        .catch((error: unknown) => {
          if (requestVersion.current !== version || isAbortError(error)) return;
          setSectionStates((state) => ({
            ...state,
            [section]: { ...state[section], filterKey, status: "error", errorStatus: 500 },
          }));
        });
    },
    [enabled, overview, overviewScope, scopeKey, sectionStates, subjectId, subjectType, workspaceId],
  );

  return useMemo(
    () => ({
      access: enabled && overviewScope === scopeKey ? overview?.access ?? null : null,
      errorStatus: overviewScope === scopeKey ? errorStatus : undefined,
      overview: enabled && overviewScope === scopeKey ? overview : null,
      overviewStatus: enabled ? overviewScope === scopeKey ? overviewStatus : "loading" : "idle",
      reloadOverview: loadOverview,
      loadSection,
      sectionStates: enabled && overviewScope === scopeKey ? sectionStates : {
        history: emptySectionState("idle"),
        reservations: emptySectionState("idle"),
        billing: emptySectionState("idle"),
      },
    }),
    [enabled, errorStatus, loadOverview, loadSection, overview, overviewScope, overviewStatus, scopeKey, sectionStates],
  );
}

function serializeFilter(filter: CustomerProfileSectionFilter) {
  return [filter.month ?? "", filter.months ?? 6, filter.patientId ?? ""].join("|");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
