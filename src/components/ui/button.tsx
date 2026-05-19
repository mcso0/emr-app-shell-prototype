import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all duration-[var(--clair-motion-duration-fast)] ease-[var(--clair-motion-easing-standard)] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--clair-shadow-sm)] hover:bg-[var(--emr-command-primary-hover-bg)] hover:shadow-[var(--clair-shadow-md)] active:shadow-[var(--clair-shadow-xs)] aria-expanded:bg-[var(--emr-command-primary-hover-bg)] aria-expanded:shadow-[var(--clair-shadow-xs)] disabled:shadow-none",
        outline:
          "border-input bg-background text-foreground shadow-[var(--clair-shadow-xs)] hover:bg-accent hover:text-accent-foreground hover:shadow-[var(--clair-shadow-sm)] active:shadow-none aria-expanded:bg-accent aria-expanded:text-accent-foreground aria-expanded:shadow-none disabled:shadow-none",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[var(--emr-state-active)] aria-expanded:bg-[var(--emr-state-active)]",
        ghost:
          "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        destructive:
          "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)] hover:bg-[var(--emr-status-danger-hover-bg)] active:bg-[var(--emr-status-danger-hover-bg)] aria-expanded:bg-[var(--emr-status-danger-hover-bg)] focus-visible:ring-destructive/20",
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
