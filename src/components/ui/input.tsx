import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Compact text entry control for EMR forms, filters, and dialogs.
 *
 * Keep visible labels at the call site with Field or form layout components.
 * Placeholder text should be a hint or example, not the only accessible label.
 *
 * @summary compact EMR text entry control
 */
export type InputProps = Omit<
  React.ComponentProps<typeof InputPrimitive>,
  "aria-invalid" | "className" | "disabled" | "placeholder" | "type"
> & {
  /**
   * Native input type. Use the narrowest type that matches the field, such as
   * `search`, `tel`, `email`, `number`, or `file`.
   */
  type?: React.HTMLInputTypeAttribute
  /**
   * Short input hint. Do not use placeholders as the only accessible label.
   */
  placeholder?: string
  /**
   * Visual disabled affordance for unavailable or locked fields. Do not treat
   * disabled inputs as the security boundary.
   */
  disabled?: boolean
  /**
   * Marks the input as invalid for assistive technology and EMR invalid styling.
   * Pair it with visible error/help text at the call site.
   */
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
  /**
   * Additional classes for layout composition. Prefer the built-in EMR control
   * sizing and state tokens for visual consistency.
   */
  className?: string
}

/**
 * Compact text entry control for EMR forms, filters, and dialogs.
 *
 * Keep visible labels at the call site with Field or form layout components.
 * Placeholder text should be a hint or example, not the only accessible label.
 *
 * @summary compact EMR text entry control
 */
function Input({ className, type, ...props }: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "emr-control-text h-[var(--clair-control-height-md)] w-full min-w-0 rounded-[var(--emr-radius-control)] border border-input bg-transparent px-2.5 py-1 text-foreground transition-colors outline-none file:inline-flex file:h-[var(--clair-control-height-xs)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--emr-text-placeholder)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--emr-surface-disabled)] disabled:text-[var(--emr-text-disabled)] disabled:opacity-100 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
