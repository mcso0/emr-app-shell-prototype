"use client"

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "group/toggle relative inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-[var(--clair-radius-atomic-8)] border border-transparent emr-control-text font-medium outline-none after:absolute after:-inset-1 after:content-[''] transition-[color,background-color,border-color,box-shadow] duration-[var(--clair-motion-duration-fast)] ease-[var(--clair-motion-easing-standard)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&:has(>svg:only-child)]:px-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-transparent text-foreground hover:bg-[var(--emr-state-hover)] data-pressed:bg-[var(--clair-color-atomic-black-alpha-6)] data-pressed:shadow-[var(--clair-shadow-xs)] dark:hover:bg-muted dark:data-pressed:bg-muted",
        primary:
          "bg-background text-[var(--clair-color-atomic-neutral-900)] shadow-[var(--clair-shadow-xs)] hover:bg-[var(--clair-color-atomic-neutral-100)] data-pressed:bg-[var(--clair-color-atomic-neutral-800)] data-pressed:text-white data-pressed:hover:bg-[var(--clair-color-atomic-neutral-900)] dark:bg-background dark:text-foreground dark:hover:bg-muted dark:data-pressed:bg-foreground dark:data-pressed:text-background",
        ghost:
          "bg-transparent text-foreground hover:bg-[var(--emr-state-hover)] data-pressed:bg-[var(--clair-color-atomic-black-alpha-6)] data-pressed:shadow-[var(--clair-shadow-xs)] dark:hover:bg-muted dark:data-pressed:bg-muted",
        outline:
          "border-[var(--emr-border-default)] bg-transparent text-foreground hover:bg-[var(--emr-state-hover)] data-pressed:bg-[var(--clair-color-atomic-black-alpha-4)] data-pressed:shadow-[var(--clair-shadow-xs)] dark:hover:bg-muted dark:data-pressed:bg-muted",
      },
      size: {
        xs: "h-7 min-w-7 px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 min-w-8 px-3",
        md: "h-9 min-w-9 px-4",
        default:
          "h-8 min-w-8 px-3",
        lg: "h-9 min-w-9 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
