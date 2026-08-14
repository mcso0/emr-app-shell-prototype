"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
  }
>({
  size: "default",
  variant: "default",
  spacing: 2,
  orientation: "horizontal",
})

const defaultSpacingByVariant = {
  default: 2,
  ghost: 0,
  outline: 0,
  primary: 1.5,
} as const

function ToggleGroup({
  className,
  variant,
  size,
  spacing,
  orientation = "horizontal",
  children,
  ...props
}: ToggleGroupPrimitive.Props &
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
  }) {
  const resolvedVariant = variant ?? "default"
  const resolvedSpacing = spacing ?? defaultSpacingByVariant[resolvedVariant]
  const connected = resolvedSpacing === 0 && resolvedVariant !== "ghost"

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={resolvedVariant}
      data-size={size}
      data-spacing={resolvedSpacing}
      data-orientation={orientation}
      data-connected={connected}
      style={
        {
          "--toggle-group-gap": resolvedSpacing,
        } as React.CSSProperties
      }
      className={cn(
        "group/toggle-group flex w-fit flex-row items-center gap-[calc(var(--toggle-group-gap)*0.25rem)] rounded-[var(--clair-radius-atomic-10)] data-[variant=primary]:bg-[var(--clair-color-atomic-neutral-100)] data-[variant=primary]:p-1 data-vertical:flex-col data-vertical:items-stretch",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{
          variant: resolvedVariant,
          size,
          spacing: resolvedSpacing,
          orientation,
        }}
      >
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      data-orientation={context.orientation}
      className={cn(
        "shrink-0 after:hidden focus:z-10 focus-visible:z-10 group-data-[connected=true]/toggle-group:rounded-none",
        context.orientation === "horizontal"
          ? "group-data-[connected=true]/toggle-group:first:rounded-l-[var(--clair-radius-atomic-8)] group-data-[connected=true]/toggle-group:last:rounded-r-[var(--clair-radius-atomic-8)] group-data-[connected=true]/toggle-group:data-[variant=outline]:border-l-0 group-data-[connected=true]/toggle-group:data-[variant=outline]:first:border-l"
          : "group-data-[connected=true]/toggle-group:first:rounded-t-[var(--clair-radius-atomic-8)] group-data-[connected=true]/toggle-group:last:rounded-b-[var(--clair-radius-atomic-8)] group-data-[connected=true]/toggle-group:data-[variant=outline]:border-t-0 group-data-[connected=true]/toggle-group:data-[variant=outline]:first:border-t",
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "px-0",
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
