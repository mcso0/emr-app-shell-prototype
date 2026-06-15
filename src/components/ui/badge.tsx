import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
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
    },
    defaultVariants: {
      variant: "default",
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
  variant = "default",
  render,
  ...props
}: BadgeProps) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
