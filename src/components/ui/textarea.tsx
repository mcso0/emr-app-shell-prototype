import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "emr-control-text flex field-sizing-content min-h-16 w-full rounded-[var(--emr-radius-control)] border border-input bg-transparent px-2.5 py-2 text-foreground transition-colors outline-none placeholder:text-[var(--emr-text-placeholder)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-[var(--emr-surface-disabled)] disabled:text-[var(--emr-text-disabled)] disabled:opacity-100 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
