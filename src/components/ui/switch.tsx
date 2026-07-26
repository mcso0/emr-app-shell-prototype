"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "xs" | "sm" | "md" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent outline-none after:absolute after:left-1/2 after:top-1/2 after:h-10 after:w-full after:min-w-10 after:-translate-x-1/2 after:-translate-y-1/2 after:content-[''] transition-[background-color,border-color,box-shadow] duration-[var(--clair-motion-duration-fast)] ease-[var(--clair-motion-easing-standard)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=xs]:h-[14px] data-[size=xs]:w-[24px] data-[size=xs]:[--switch-thumb-translate:10px] data-[size=sm]:h-[18px] data-[size=sm]:w-[32px] data-[size=sm]:[--switch-thumb-translate:14px] data-[size=default]:h-[18px] data-[size=default]:w-[32px] data-[size=default]:[--switch-thumb-translate:14px] data-[size=md]:h-[24px] data-[size=md]:w-[44px] data-[size=md]:[--switch-thumb-translate:20px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-[var(--clair-color-atomic-neutral-900)] data-unchecked:bg-[var(--clair-color-atomic-neutral-200)] dark:data-checked:bg-foreground dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-background ring-0 transition-transform duration-[var(--clair-motion-duration-fast)] ease-[var(--clair-motion-easing-standard)] group-data-[size=xs]/switch:size-3 group-data-[size=sm]/switch:size-4 group-data-[size=default]/switch:size-4 group-data-[size=md]/switch:size-5 data-checked:translate-x-[var(--switch-thumb-translate)] data-unchecked:translate-x-0 group-data-[size=xs]/switch:ml-px group-data-[size=sm]/switch:ml-px group-data-[size=default]/switch:ml-px group-data-[size=md]/switch:ml-0.5 dark:data-checked:bg-background dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
