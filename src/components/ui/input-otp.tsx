"use client"

import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"

import { cn } from "@/lib/utils"

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "emr-input-otp flex w-full items-center has-disabled:opacity-50",
        containerClassName
      )}
      spellCheck={false}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn(
        "flex min-w-0 items-center rounded-[var(--emr-radius-control)] has-aria-invalid:border-[var(--emr-status-danger-border)] has-aria-invalid:ring-3 has-aria-invalid:ring-[var(--emr-status-danger-border)]/20",
        className
      )}
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number
}) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "emr-control-text relative flex aspect-square w-full min-w-0 items-center justify-center border-y border-r border-[var(--emr-border-default)] bg-background text-center font-semibold text-foreground transition-all outline-none first:rounded-l-[var(--emr-radius-control)] first:border-l last:rounded-r-[var(--emr-radius-control)] aria-invalid:border-[var(--emr-status-danger-border)] data-[active=true]:z-10 data-[active=true]:border-[var(--emr-state-selected-border)] data-[active=true]:ring-3 data-[active=true]:ring-[var(--emr-state-selected-border)]/20 data-[active=true]:aria-invalid:border-[var(--emr-status-danger-border)] data-[active=true]:aria-invalid:ring-[var(--emr-status-danger-border)]/20",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-[var(--emr-state-selected-border)] duration-1000" />
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-separator"
      className="flex items-center justify-center px-1.5 text-[var(--clair-color-line-strong)]"
      role="separator"
      {...props}
    >
      <span className="h-px w-2 bg-current" aria-hidden="true" />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
