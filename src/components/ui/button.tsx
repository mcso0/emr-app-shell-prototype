import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,color,opacity,transform] duration-[var(--clair-motion-duration-fast)] ease-[var(--clair-motion-easing-standard)] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0",
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
          "bg-transparent text-foreground hover:bg-[var(--emr-state-hover)] hover:text-foreground aria-expanded:bg-[var(--emr-state-hover)] aria-expanded:text-foreground",
        destructive:
          "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)] hover:bg-[var(--emr-status-danger-hover-bg)] active:bg-[var(--emr-status-danger-hover-bg)] aria-expanded:bg-[var(--emr-status-danger-hover-bg)] focus-visible:ring-destructive/20",
      },
      size: {
        default:
          "emr-control-text h-[var(--clair-control-height-md)] gap-1 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        xs: "emr-control-text-compact h-[var(--clair-control-height-xs)] gap-1 px-2 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "emr-control-text-compact h-[var(--clair-control-height-sm)] gap-1 px-2 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "emr-control-text h-[var(--clair-control-height-lg)] gap-1.5 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5 [&_svg:not([class*='size-'])]:size-4",
        xl: "emr-control-text h-[var(--clair-control-height-xl)] gap-1.5 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5 [&_svg:not([class*='size-'])]:size-4",
        icon: "size-[var(--clair-control-height-md)] [&_svg:not([class*='size-'])]:size-4",
        "icon-xs": "size-[var(--clair-control-height-xs)] [&_svg:not([class*='size-'])]:size-3",
        tiny: "size-[18px] !rounded-[var(--clair-radius-atomic-4)] p-[2px] [&_svg:not([class*='size-'])]:size-[14px]",
        "icon-sm": "size-[var(--clair-control-height-sm)] [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-[var(--clair-control-height-lg)] [&_svg:not([class*='size-'])]:size-4",
        "icon-xl": "size-[var(--clair-control-height-xl)] [&_svg:not([class*='size-'])]:size-4",
      },
      roundness: {
        default: "emr-control-radius",
        round: "rounded-[9999px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      roundness: "default",
    },
  }
)

type ButtonVariantProps = VariantProps<typeof buttonVariants>

/**
 * Command button for explicit user actions in CLAiR EMR.
 *
 * Use Button for save, retry, cancel, destructive, and other non-navigation commands.
 * Use Links or route-aware controls for navigation. Icon-only buttons must include
 * an accessible label such as `aria-label`.
 *
 * @summary command button for explicit EMR actions
 */
export type ButtonProps = ButtonPrimitive.Props & {
  /**
   * Visual command priority. Use `default` for the main action, `outline` or
   * `secondary` for supporting actions, `ghost` for quiet actions, and
   * `destructive` only for high-risk actions such as delete or cancel.
   */
  variant?: ButtonVariantProps["variant"]
  /**
   * Control height and icon scale. Use smaller sizes in dense tables and panels,
   * and reserve larger sizes for spacious dialogs.
   */
  size?: ButtonVariantProps["size"]
  /**
   * Shape of the button. Keep `default` for most EMR controls; use `round` only
   * for compact pill-like commands.
   */
  roundness?: ButtonVariantProps["roundness"]
  /**
   * Additional classes for layout composition. Prefer existing variants and sizes
   * before adding custom visual styling.
   */
  className?: string
}

/**
 * Command button for explicit user actions in CLAiR EMR.
 *
 * Use Button for save, retry, cancel, destructive, and other non-navigation commands.
 * Use Links or route-aware controls for navigation. Icon-only buttons must include
 * an accessible label such as `aria-label`.
 *
 * @summary command button for explicit EMR actions
 */
function Button({
  className,
  variant = "default",
  size = "default",
  roundness = "default",
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, roundness, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
