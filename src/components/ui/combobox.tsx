"use client";

import { useEffect, useState, type ComponentProps } from "react";
import {
  Combobox as SdkCombobox,
  createComboboxController,
  type ComboboxProps,
  ComboboxClear,
  ComboboxContent as SdkComboboxContent,
  ComboboxEmpty,
  ComboboxInput as SdkComboboxInput,
  ComboboxItem as SdkComboboxItem,
  ComboboxList,
  ComboboxStatus,
} from "@ui-sdk/react/combobox";
import { useModuleSidePanel } from "@/components/emr/module-side-panel-context";
import { usePagePortalVisibility } from "@/components/emr/page-loading-boundary";
import { inputClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function Combobox<T = string>({ controller: providedController, ...props }: ComboboxProps<T, false>) {
  const [localController] = useState(() => createComboboxController<T, false>());
  const controller = providedController ?? localController;
  const panel = useModuleSidePanel();
  const visibility = usePagePortalVisibility();
  const hidden = panel?.visible === false || Boolean(visibility.hidden);
  useEffect(() => {
    if (hidden) controller.setOpen(false);
  }, [controller, hidden]);
  return <SdkCombobox<T, false> controller={controller} {...props} />;
}

function ComboboxInput({ className, ...props }: ComponentProps<typeof SdkComboboxInput>) {
  return <SdkComboboxInput data-ui-sdk-search-input="" className={cn(inputClassName, className)} {...props} />;
}

/** UI SDK owns positioning, dismissal and active-descendant navigation. No Base popup or input is nested here. */
function ComboboxContent({ className, ...props }: ComponentProps<typeof SdkComboboxContent>) {
  const panel = useModuleSidePanel();
  const visibility = usePagePortalVisibility();
  return (
    <SdkComboboxContent
      align="start"
      sideOffset={4}
      data-module-side-panel-owner={panel?.ownerId}
      className={cn("z-[80] grid w-[var(--anchor-width)] max-h-[min(18rem,var(--available-height))] gap-1 overflow-y-auto rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none", className)}
      {...props}
      {...visibility}
    />
  );
}

function ComboboxItem({ className, ...props }: ComponentProps<typeof SdkComboboxItem<string>>) {
  return <SdkComboboxItem className={cn("grid cursor-default gap-0.5 rounded-md px-2.5 py-2 text-left outline-none transition-colors hover:bg-[var(--emr-state-hover)] data-highlighted:bg-[var(--emr-state-hover)] data-selected:bg-[var(--emr-state-selected)] data-disabled:pointer-events-none data-disabled:opacity-50", className)} {...props} />;
}

export { Combobox, ComboboxClear, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxStatus };
