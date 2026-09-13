import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-[var(--clair-motion-duration-fast)] ease-[var(--clair-motion-easing-standard)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        count:
          "size-4 min-w-4 rounded-[var(--clair-radius-full)] border-0 px-0 py-0 text-xs leading-4 tracking-[0.3px]",
        sm: "h-5 px-2 py-0.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3!",
        md: "h-[22px] px-2.5 py-0.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&>svg]:size-3!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  }
)

type BadgeVariantProps = VariantProps<typeof badgeVariants>

/**
 * Compact generic label or chip for non-domain status metadata.
 *
 * Use Badge for short categories, filters, and lightweight labels. Do not use
 * generic Badge to encode EMR workflow status; use `EmrStatusBadge` or a
 * feature-specific status component for clinical, billing, or fulfillment state.
 *
 * @summary compact generic label or chip
 */
export type BadgeProps = Omit<useRender.ComponentProps<"span">, "className" | "render"> & {
  /**
   * Generic visual emphasis. Domain status tone belongs in EMR-specific status
   * components instead of ad hoc Badge variants.
   */
  variant?: BadgeVariantProps["variant"]
  /**
   * Visual density. `count` is the fixed 16px circular counter used in compact
   * tabs, `sm` preserves the historical compact 20px badge, and `md` matches
   * the CDS V2 22px badge used in dense headers and toolbar metadata.
   */
  size?: BadgeVariantProps["size"]
  /**
   * Optional custom renderer from Base UI. Keep default span rendering unless a
   * consuming component needs a specific semantic element.
   */
  render?: useRender.ComponentProps<"span">["render"]
  /**
   * Additional classes for layout composition. Avoid custom status colors here.
   */
  className?: string
}

/**
 * Compact generic label or chip for non-domain status metadata.
 *
 * Use Badge for short categories, filters, and lightweight labels. Do not use
 * generic Badge to encode EMR workflow status; use `EmrStatusBadge` or a
 * feature-specific status component for clinical, billing, or fulfillment state.
 *
 * @summary compact generic label or chip
 */
function Badge({
  className,
  size = "sm",
  variant = "default",
  render,
  ...props
}: BadgeProps) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ size, variant }), className),
      },
      props
    ),
    render,
    state: {
      size,
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
