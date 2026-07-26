"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import checkboxCheck from "@/assets/figma/checkbox-check.svg"
import checkboxMinus from "@/assets/figma/checkbox-minus.svg"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer group/checkbox relative flex size-4 shrink-0 items-center justify-center rounded-[var(--clair-radius-atomic-4)] border-0 bg-transparent text-[var(--clair-color-atomic-common-100)] outline-none before:pointer-events-none before:absolute before:inset-px before:rounded-[var(--clair-radius-atomic-4)] before:border before:border-[var(--clair-color-atomic-neutral-300)] before:bg-[var(--clair-color-atomic-common-100)] before:shadow-[var(--clair-shadow-xs)] after:absolute after:-inset-x-3 after:-inset-y-2 data-checked:before:inset-0 data-checked:before:border-[var(--clair-color-atomic-neutral-900)] data-checked:before:bg-[var(--clair-color-atomic-neutral-900)] data-checked:before:shadow-none data-indeterminate:before:inset-0 data-indeterminate:before:border-[var(--clair-color-atomic-neutral-900)] data-indeterminate:before:bg-[var(--clair-color-atomic-neutral-900)] data-indeterminate:before:shadow-none focus-visible:before:border-[var(--clair-color-atomic-neutral-500)] focus-visible:before:ring-3 focus-visible:before:ring-[var(--clair-color-atomic-neutral-300)] data-checked:focus-visible:before:border-[var(--clair-color-atomic-neutral-900)] data-checked:focus-visible:before:ring-[var(--clair-color-atomic-neutral-400)] data-indeterminate:focus-visible:before:border-[var(--clair-color-atomic-neutral-900)] data-indeterminate:focus-visible:before:ring-[var(--clair-color-atomic-neutral-400)] aria-invalid:before:border-[var(--clair-color-atomic-red-500)] aria-invalid:data-checked:before:border-[var(--clair-color-atomic-red-600)] aria-invalid:data-checked:before:bg-[var(--clair-color-atomic-red-600)] aria-invalid:focus-visible:before:ring-[var(--clair-color-atomic-red-200)] disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 group-has-disabled/field:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="relative z-10 grid size-[14px] place-content-center transition-none"
      >
        {/* Exact exported Figma vector; a raw img preserves its subpixel geometry. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          aria-hidden="true"
          className="block h-[7.29158px] w-[10.2083px] group-data-indeterminate/checkbox:hidden"
          src={checkboxCheck.src}
        />
        {/* Exact exported Figma vector; a raw img preserves its subpixel geometry. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          aria-hidden="true"
          className="hidden h-[0.875px] w-[9.04167px] group-data-indeterminate/checkbox:block"
          src={checkboxMinus.src}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
