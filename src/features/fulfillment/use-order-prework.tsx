"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useAuthClient } from "@/features/auth/auth-client";
import { useSharedReadActorScope } from "@/features/auth/shared-read-actor-scope";
import type { WorkspaceSlotAvailabilityProvider, WorkspaceSlotAvailabilityProviderProps } from "@/types/emr";

const Presentation = createContext<{ prework: boolean; setPrework: Dispatch<SetStateAction<boolean>> } | null>(null);

/** Opt-in only for order modules. Chart never uses this provider. */
export function withOrderPreworkSlots(Provider: WorkspaceSlotAvailabilityProvider): WorkspaceSlotAvailabilityProvider {
  function OrderSlots(props: WorkspaceSlotAvailabilityProviderProps) {
    return <OrderSlotsScope key={`${props.workspaceId}:${props.moduleId}`} {...props} />;
  }
  function OrderSlotsScope({ children, ...props }: WorkspaceSlotAvailabilityProviderProps) {
    const [prework, setPrework] = useState(true);
    return <Presentation.Provider value={{ prework, setPrework }}><Provider {...props}>{availability => children({
      ...availability,
      orderPrework: prework,
      hasContentAside: prework ? false : availability.hasContentAside,
      hasRightPanel: prework ? false : availability.hasRightPanel,
    })}</Provider></Presentation.Provider>;
  }
  return OrderSlots;
}

export function useOrderPreworkPresentation() {
  return useContext(Presentation)?.prework ?? false;
}

/** Session-local entry intent. Ownership and mutation authority remain server-owned. */
export function useOrderPrework({ scopeKey, requested, ownsWork, pending = false }: {
  scopeKey: string;
  requested: boolean;
  ownsWork: boolean;
  pending?: boolean;
}) {
  const { session } = useAuthClient();
  const actorScope = useSharedReadActorScope(session);
  const key = `${actorScope ?? "anonymous"}:${scopeKey}`;
  const [entered, setEntered] = useState<string | null>(null);
  const [previous, setPrevious] = useState({ key, ownsWork });
  if (previous.key !== key || previous.ownsWork !== ownsWork) {
    setPrevious({ key, ownsWork });
    if (previous.key !== key || (previous.ownsWork && !ownsWork)) setEntered(null);
  }
  const currentKey = useRef(key);
  const presentation = useContext(Presentation);
  const setPrework = presentation?.setPrework;
  const show = requested && (!ownsWork || entered !== key);
  useLayoutEffect(() => {
    currentKey.current = key;
  }, [key, ownsWork]);
  useLayoutEffect(() => { setPrework?.(pending || show); }, [pending, show, setPrework]);
  return {
    show,
    enter: () => { if (currentKey.current === key) setEntered(key); },
  };
}
