import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all duration-[var(--clair-motion-duration-fast)] ease-[var(--clair-motion-easing-standard)] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--clair-color-atomic-gray-900)] text-[var(--clair-color-static-white)] hover:bg-[var(--clair-color-atomic-gray-700)] aria-expanded:bg-[var(--clair-color-atomic-gray-700)]",
        outline:
          "border-[var(--clair-color-line-normal)] bg-background text-[var(--clair-color-label-strong)] hover:bg-[var(--clair-color-background-surface)] aria-expanded:bg-[var(--clair-color-background-surface)]",
        secondary:
          "bg-[var(--clair-color-background-surface)] text-[var(--clair-color-label-strong)] hover:bg-[var(--clair-color-background-subtle)] aria-expanded:bg-[var(--clair-color-background-subtle)]",
        ghost:
          "bg-transparent text-[var(--clair-color-label-strong)] hover:bg-[var(--clair-color-background-subtle)] aria-expanded:bg-[var(--clair-color-background-subtle)]",
        destructive:
          "bg-[var(--clair-color-status-negative-background)] text-[var(--clair-color-status-negative-foreground)] hover:bg-[var(--clair-color-atomic-red-100)] focus-visible:ring-destructive/20",
      },
      size: {
        default:
          "h-[var(--clair-control-height-md)] gap-1 px-3 text-[14px] leading-5 tracking-[0.014em] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        xs: "h-[var(--clair-control-height-xs)] gap-1 px-2 text-[12px] leading-4 tracking-[0.025em] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[var(--clair-control-height-sm)] gap-1 px-2 text-[12px] leading-4 tracking-[0.025em] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-[var(--clair-control-height-lg)] gap-1.5 px-4 text-[14px] leading-5 tracking-[0.014em] has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5 [&_svg:not([class*='size-'])]:size-4",
        icon: "size-[var(--clair-control-height-md)] [&_svg:not([class*='size-'])]:size-4",
        "icon-xs": "size-[var(--clair-control-height-xs)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-[var(--clair-control-height-sm)] [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-[var(--clair-control-height-lg)] [&_svg:not([class*='size-'])]:size-4",
      },
      roundness: {
        default: "rounded-[var(--clair-radius-md)]",
        round: "rounded-[var(--clair-radius-full)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      roundness: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  roundness = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, roundness, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
