import { cn } from "@/lib/utils";

export function EmrRequiredIndicator({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-slot="emr-required-indicator"
      className={cn(
        "shrink-0 text-[var(--emr-form-required-indicator)]",
        className,
      )}
    >
      *
    </span>
  );
}
