"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Autocomplete as SdkAutocomplete, AutocompleteContent as SdkAutocompleteContent, AutocompleteInput as SdkAutocompleteInput, AutocompleteItem as SdkAutocompleteItem, AutocompleteList, createAutocompleteController } from "@ui-sdk/react/autocomplete";
import { useModuleSidePanel } from "@/components/emr/module-side-panel-context";
import { usePagePortalVisibility } from "@/components/emr/page-loading-boundary";
import { inputClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function Autocomplete({ controller: providedController, ...props }: ComponentProps<typeof SdkAutocomplete>) {
  const [localController] = useState(createAutocompleteController);
  const controller = providedController ?? localController;
  const panel = useModuleSidePanel();
  const visibility = usePagePortalVisibility();
  const hidden = panel?.visible === false || Boolean(visibility.hidden);
  useEffect(() => { if (hidden) controller.setOpen(false); }, [controller, hidden]);
  return <SdkAutocomplete controller={controller} {...props} />;
}
function AutocompleteInput({ className, ...props }: ComponentProps<typeof SdkAutocompleteInput>) {
  return <SdkAutocompleteInput className={cn(inputClassName, className)} {...props} />;
}
function AutocompleteContent({ className, ...props }: ComponentProps<typeof SdkAutocompleteContent>) {
  const panel = useModuleSidePanel();
  const visibility = usePagePortalVisibility();
  return <SdkAutocompleteContent align="start" sideOffset={4} data-module-side-panel-owner={panel?.ownerId} className={cn("z-[80] grid w-[var(--anchor-width)] max-h-[min(14rem,var(--available-height))] gap-1 overflow-y-auto rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none", className)} {...props} {...visibility} />;
}
function AutocompleteItem({ className, ...props }: ComponentProps<typeof SdkAutocompleteItem>) {
  return <SdkAutocompleteItem className={cn("cursor-default rounded-md px-2.5 py-2 text-left emr-text-dense font-medium text-[var(--emr-text-secondary)] outline-none transition-colors hover:bg-[var(--emr-state-hover)] data-highlighted:bg-[var(--emr-state-hover)] data-disabled:pointer-events-none data-disabled:opacity-50", className)} {...props} />;
}
export { Autocomplete, AutocompleteContent, AutocompleteInput, AutocompleteItem, AutocompleteList };
